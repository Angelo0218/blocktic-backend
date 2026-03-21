import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { createHash } from 'crypto';
import {
  RekognitionClient,
  DetectFacesCommand,
  type FaceDetail,
} from '@aws-sdk/client-rekognition';
import { Person, KycStatus } from './entities/person.entity';
import { User } from '../auth/entities/user.entity';
import { BlockchainService } from '../blockchain/blockchain.service';
import { SubmitKycDto } from './dto/submit-kyc.dto';
import { KycSubmitResponseDto, KycStatusResponseDto } from './dto/kyc-status.dto';
import { fetchWithTimeout } from '../common/utils/fetch-with-timeout';

/** KYC SBT attestation token ID（範圍 1–999） */
const KYC_ATTESTATION_TOKEN_ID = 1;

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);

  private readonly rekognition: RekognitionClient;
  private readonly comprefaceUrl: string;
  private readonly verifyApiKey: string;
  private readonly recognizeApiKey: string;
  private readonly faceMatchThreshold: number;
  private readonly livenessConfidenceThreshold: number;
  private readonly livenessSharpnessThreshold: number;
  private readonly livenessBrightnessThreshold: number;

  constructor(
    @InjectRepository(Person)
    private readonly personRepo: Repository<Person>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly blockchainService: BlockchainService,
  ) {
    const awsKey = this.config.get<string>('AWS_ACCESS_KEY_ID', '');
    const awsSecret = this.config.get<string>('AWS_SECRET_ACCESS_KEY', '');

    if (awsKey && !awsKey.startsWith('your-')) {
      this.rekognition = new RekognitionClient({
        region: this.config.get<string>('AWS_REGION', 'ap-northeast-1'),
        credentials: { accessKeyId: awsKey, secretAccessKey: awsSecret },
      });
    }

    this.comprefaceUrl = this.config.get<string>('COMPREFACE_URL', 'http://compreface-api:8000');
    this.verifyApiKey = this.config.get<string>('COMPREFACE_VERIFY_API_KEY', '');
    this.recognizeApiKey = this.config.get<string>('COMPREFACE_RECOGNIZE_API_KEY', '');
    this.faceMatchThreshold = this.config.get<number>('FACE_MATCH_THRESHOLD', 0.85);
    this.livenessConfidenceThreshold = this.config.get<number>('LIVENESS_CONFIDENCE_THRESHOLD', 90);
    this.livenessSharpnessThreshold = this.config.get<number>('LIVENESS_SHARPNESS_THRESHOLD', 30);
    this.livenessBrightnessThreshold = this.config.get<number>('LIVENESS_BRIGHTNESS_THRESHOLD', 20);
  }

  // ──────────────────────────────────────────────
  //  Public API
  // ──────────────────────────────────────────────

  /**
   * Submit KYC verification with the 4-layer defense:
   *  1. ID document uniqueness (hash check)
   *  2. Liveness detection (AWS Rekognition)
   *  3. 1:1 face comparison (CompreFace)
   *  4. 1:N face deduplication (CompreFace)
   */
  async submitKyc(dto: SubmitKycDto, authUserId?: string): Promise<KycSubmitResponseDto> {
    if (!dto.consent) {
      throw new BadRequestException(
        'User must explicitly consent to biometric data processing.',
      );
    }

    // 去除 data URL prefix（前端可能送 data:image/jpeg;base64,... 格式）
    const idCardImage = this.stripDataUrlPrefix(dto.idCardImage);
    const selfieImage = this.stripDataUrlPrefix(dto.selfieImage);

    // 整個 KYC 四層防線包裹在 DB transaction 中，避免部分狀態殘留
    return this.dataSource.transaction(async (manager) => {
      const personRepo = manager.getRepository(Person);

      // Create or retrieve person record
      let person: Person;
      if (dto.userId) {
        const existing = await personRepo.findOne({ where: { id: dto.userId } });
        if (!existing) {
          throw new NotFoundException(`Person with id ${dto.userId} not found.`);
        }
        person = existing;
      } else {
        person = personRepo.create({
          kycStatus: KycStatus.PENDING,
          consentRecordedAt: new Date(),
        });
        person = await personRepo.save(person);
      }

      try {
        // ── Layer 1: ID Document Uniqueness ───────────────────
        // 依賴 DB unique constraint 防止 race condition
        const idHash = this.hashDocument(idCardImage);
        const duplicate = await personRepo.findOne({
          where: { personIdHash: idHash },
        });
        if (duplicate && duplicate.id !== person.id) {
          person.kycStatus = KycStatus.REJECTED;
          await personRepo.save(person);
          return this.buildResponse(person, 'Rejected: duplicate ID document detected.');
        }
        person.personIdHash = idHash;
        person.kycStatus = KycStatus.ID_VERIFIED;

        // ── Layer 2: Liveness Detection (AWS Rekognition) ─────
        const livenessResult = await this.detectLiveness(selfieImage);
        if (!livenessResult.isLive) {
          person.kycStatus = KycStatus.REJECTED;
          await personRepo.save(person);
          return this.buildResponse(person, 'Rejected: liveness check failed.');
        }
        person.kycStatus = KycStatus.LIVENESS_PASSED;

        // ── Layer 3: 1:1 Face Comparison (CompreFace) ─────────
        const faceMatchResult = await this.compareFaces(idCardImage, selfieImage);
        if (!faceMatchResult.isMatch) {
          person.kycStatus = KycStatus.REJECTED;
          await personRepo.save(person);
          return this.buildResponse(
            person,
            'Rejected: selfie does not match ID document photo.',
          );
        }
        person.kycStatus = KycStatus.FACE_MATCHED;

        // ── Layer 4: 1:N Face Deduplication (CompreFace) ──────
        const dedupResult = await this.deduplicateFace(selfieImage, person.id);
        if (dedupResult.duplicateFound) {
          person.kycStatus = KycStatus.REJECTED;
          await personRepo.save(person);
          return this.buildResponse(
            person,
            'Rejected: face already registered under another account.',
          );
        }
        person.faceEmbeddingRef = dedupResult.subjectId;

        // ── All layers passed — 一次性寫入最終狀態 ──────────
        person.kycStatus = KycStatus.APPROVED;
        await personRepo.save(person);

        // ── 建立 AA 錢包 + 鑄造 KYC SBT（失敗不影響 KYC 狀態）──
        try {
          const wallet = await this.blockchainService.createAAWallet(person.id);
          person.aaWalletAddress = wallet.walletAddress;

          const txHash = await this.blockchainService.mintKycSbt(
            wallet.walletAddress,
            KYC_ATTESTATION_TOKEN_ID,
          );
          person.kycAttestationTxHash = txHash;
          await personRepo.save(person);
        } catch (blockchainError) {
          // 區塊鏈操作失敗不應影響已通過的 KYC 結果，可稍後重試
          this.logger.error(
            `KYC 已通過但區塊鏈操作失敗 person=${person.id}，可稍後重試`,
            blockchainError,
          );
        }

        // ── 關聯 Auth User ↔ Person（讓票務/驗票可透過 userId 找到 KYC 資料）──
        if (authUserId) {
          const userRepo = manager.getRepository(User);
          await userRepo.update(authUserId, { personId: person.id });
          this.logger.log(`Auth User ${authUserId} linked to Person ${person.id}`);
        }

        return this.buildResponse(person, 'KYC approved. All verification layers passed.');
      } catch (error) {
        this.logger.error(`KYC verification failed for person ${person.id}`, error);
        person.kycStatus = KycStatus.REJECTED;
        await personRepo.save(person);
        throw error;
      }
    });
  }

  /**
   * Retrieve the current KYC status for a user.
   */
  async getKycStatus(userId: string): Promise<KycStatusResponseDto> {
    const person = await this.personRepo.findOne({ where: { id: userId } });
    if (!person) {
      throw new NotFoundException(`Person with id ${userId} not found.`);
    }
    return {
      userId: person.id,
      kycStatus: person.kycStatus,
      aaWalletAddress: person.aaWalletAddress,
      kycAttestationTxHash: person.kycAttestationTxHash,
      consentRecordedAt: person.consentRecordedAt,
      createdAt: person.createdAt,
      updatedAt: person.updatedAt,
    };
  }

  /**
   * Delete all user data (GDPR right-to-erasure).
   * Removes the person record and requests deletion from external stores.
   */
  async deleteUserData(userId: string): Promise<{ deleted: boolean }> {
    const person = await this.personRepo.findOne({ where: { id: userId } });
    if (!person) {
      throw new NotFoundException(`Person with id ${userId} not found.`);
    }

    // 刪除 CompreFace 中的人臉嵌入向量
    if (person.faceEmbeddingRef) {
      await this.deleteFaceFromCompreFace(person.faceEmbeddingRef);
    }

    await this.personRepo.remove(person);

    this.logger.log(`GDPR deletion completed for person ${userId}`);
    return { deleted: true };
  }

  // ──────────────────────────────────────────────
  //  Private helpers
  // ──────────────────────────────────────────────

  /**
   * 去除 data URL prefix（例如 "data:image/jpeg;base64,"）。
   */
  private stripDataUrlPrefix(base64: string): string {
    const commaIndex = base64.indexOf(',');
    if (commaIndex !== -1 && base64.startsWith('data:')) {
      return base64.slice(commaIndex + 1);
    }
    return base64;
  }

  /**
   * SHA-256 hash of the ID document image for uniqueness checking.
   */
  private hashDocument(base64Image: string): string {
    return createHash('sha256').update(base64Image).digest('hex');
  }

  /**
   * Layer 2: AWS Rekognition DetectFaces — 透過人臉品質屬性判斷活體。
   *
   * 檢查 Confidence、Sharpness、Brightness 等指標，
   * 照片攻擊通常會在這些品質指標上表現異常。
   */
  private async detectLiveness(
    selfieBase64: string,
  ): Promise<{ isLive: boolean; confidence: number }> {
    if (!this.rekognition) {
      this.logger.warn('AWS Rekognition 未設定 — 活體偵測跳過（開發模式）');
      return { isLive: true, confidence: 0 };
    }

    const imageBuffer = Buffer.from(selfieBase64, 'base64');

    const command = new DetectFacesCommand({
      Image: { Bytes: imageBuffer },
      Attributes: ['ALL'],
    });

    const response = await this.rekognition.send(command);
    const faces = response.FaceDetails ?? [];

    if (faces.length === 0) {
      this.logger.warn('活體偵測：未偵測到任何人臉');
      return { isLive: false, confidence: 0 };
    }

    if (faces.length > 1) {
      this.logger.warn(`活體偵測：偵測到 ${faces.length} 張人臉，預期 1 張`);
      return { isLive: false, confidence: 0 };
    }

    const face: FaceDetail = faces[0];
    const confidence = face.Confidence ?? 0;
    const sharpness = face.Quality?.Sharpness ?? 0;
    const brightness = face.Quality?.Brightness ?? 0;

    // 眼睛張開檢查（防靜態照片）
    const eyesOpen = face.EyesOpen?.Value === true && (face.EyesOpen?.Confidence ?? 0) > 80;

    const isLive =
      confidence > this.livenessConfidenceThreshold &&
      sharpness > this.livenessSharpnessThreshold &&
      brightness > this.livenessBrightnessThreshold &&
      eyesOpen;

    this.logger.log(
      `活體偵測結果 — confidence=${confidence.toFixed(1)}, ` +
        `sharpness=${sharpness.toFixed(1)}, brightness=${brightness.toFixed(1)}, ` +
        `eyesOpen=${eyesOpen}, isLive=${isLive}`,
    );

    return { isLive, confidence };
  }

  /**
   * Layer 3: CompreFace 1:1 人臉比對 — 證件照 vs 自拍照。
   *
   * 呼叫 CompreFace Verification API 比對兩張照片的相似度。
   */
  private async compareFaces(
    idCardBase64: string,
    selfieBase64: string,
  ): Promise<{ isMatch: boolean; similarity: number }> {
    const formData = new FormData();
    formData.append('source_image', new Blob([Buffer.from(idCardBase64, 'base64')]), 'id.jpg');
    formData.append('target_image', new Blob([Buffer.from(selfieBase64, 'base64')]), 'selfie.jpg');

    const response = await fetchWithTimeout(
      `${this.comprefaceUrl}/api/v1/verification/verify`,
      {
        method: 'POST',
        headers: { 'x-api-key': this.verifyApiKey },
        body: formData,
      },
    );

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`CompreFace 1:1 比對失敗 — status=${response.status}, body=${body}`);
      throw new InternalServerErrorException('Face comparison service unavailable.');
    }

    const data = await response.json() as {
      result: Array<{ face_matches: Array<{ similarity: number }> }>;
    };

    const similarity = data.result?.[0]?.face_matches?.[0]?.similarity ?? 0;
    const isMatch = similarity >= this.faceMatchThreshold;

    this.logger.log(`1:1 人臉比對 — similarity=${similarity.toFixed(3)}, isMatch=${isMatch}`);
    return { isMatch, similarity };
  }

  /**
   * Layer 4: CompreFace 1:N 人臉去重 — 防止一人多帳號。
   *
   * 先用 Recognition API 搜尋是否已有相似人臉，若無重複則註冊新人臉。
   */
  private async deduplicateFace(
    selfieBase64: string,
    personId: string,
  ): Promise<{ duplicateFound: boolean; subjectId: string }> {
    const imageBuffer = Buffer.from(selfieBase64, 'base64');

    // Step 1: 搜尋現有人臉集合中是否有重複
    const recognizeForm = new FormData();
    recognizeForm.append('file', new Blob([imageBuffer]), 'selfie.jpg');

    const recognizeResp = await fetchWithTimeout(
      `${this.comprefaceUrl}/api/v1/recognition/recognize`,
      {
        method: 'POST',
        headers: { 'x-api-key': this.recognizeApiKey },
        body: recognizeForm,
      },
    );

    // CompreFace 人臉集合為空時回傳 400，此為預期行為（第一位使用者）
    // 其他非成功回應視為服務異常，應中斷流程
    if (!recognizeResp.ok && recognizeResp.status !== 400) {
      const body = await recognizeResp.text();
      this.logger.error(`CompreFace 辨識服務異常 — status=${recognizeResp.status}, body=${body}`);
      throw new InternalServerErrorException('Face recognition service unavailable.');
    }

    if (recognizeResp.ok) {
      const recognizeData = await recognizeResp.json() as {
        result: Array<{ subjects: Array<{ subject: string; similarity: number }> }>;
      };

      const topMatch = recognizeData.result?.[0]?.subjects?.[0];
      if (topMatch && topMatch.similarity >= this.faceMatchThreshold) {
        this.logger.warn(
          `人臉去重：發現重複 — 匹配 subject=${topMatch.subject}, ` +
            `similarity=${topMatch.similarity.toFixed(3)}`,
        );
        return { duplicateFound: true, subjectId: topMatch.subject };
      }
    }

    // Step 2: 無重複 → 註冊新人臉
    const addForm = new FormData();
    addForm.append('file', new Blob([imageBuffer]), 'selfie.jpg');

    const addResp = await fetchWithTimeout(
      `${this.comprefaceUrl}/api/v1/recognition/faces?subject=${encodeURIComponent(personId)}`,
      {
        method: 'POST',
        headers: { 'x-api-key': this.recognizeApiKey },
        body: addForm,
      },
    );

    if (!addResp.ok) {
      const body = await addResp.text();
      this.logger.error(`CompreFace 人臉註冊失敗 — status=${addResp.status}, body=${body}`);
      throw new InternalServerErrorException('Face registration service unavailable.');
    }

    this.logger.log(`人臉已註冊 — subject=${personId}`);
    return { duplicateFound: false, subjectId: personId };
  }

  /**
   * 從 CompreFace 刪除人臉嵌入（GDPR 資料刪除）。
   */
  private async deleteFaceFromCompreFace(subjectId: string): Promise<void> {
    const resp = await fetchWithTimeout(
      `${this.comprefaceUrl}/api/v1/recognition/faces?subject=${encodeURIComponent(subjectId)}`,
      {
        method: 'DELETE',
        headers: { 'x-api-key': this.recognizeApiKey },
      },
    );

    if (!resp.ok) {
      this.logger.warn(`CompreFace 人臉刪除失敗 — subject=${subjectId}, status=${resp.status}`);
    } else {
      this.logger.log(`CompreFace 人臉已刪除 — subject=${subjectId}`);
    }
  }

  private buildResponse(person: Person, message: string): KycSubmitResponseDto {
    return {
      userId: person.id,
      kycStatus: person.kycStatus,
      message,
    };
  }
}

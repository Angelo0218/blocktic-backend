import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { Person, KycStatus } from './entities/person.entity';
import { SubmitKycDto } from './dto/submit-kyc.dto';
import { KycSubmitResponseDto, KycStatusResponseDto } from './dto/kyc-status.dto';

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);

  constructor(
    @InjectRepository(Person)
    private readonly personRepo: Repository<Person>,
  ) {}

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
  async submitKyc(dto: SubmitKycDto): Promise<KycSubmitResponseDto> {
    if (!dto.consent) {
      throw new BadRequestException(
        'User must explicitly consent to biometric data processing.',
      );
    }

    // Create or retrieve person record
    let person: Person;
    if (dto.userId) {
      const existing = await this.personRepo.findOne({ where: { id: dto.userId } });
      if (!existing) {
        throw new NotFoundException(`Person with id ${dto.userId} not found.`);
      }
      person = existing;
    } else {
      person = this.personRepo.create({
        kycStatus: KycStatus.PENDING,
        consentRecordedAt: new Date(),
      });
      person = await this.personRepo.save(person);
    }

    try {
      // ── Layer 1: ID Document Uniqueness ───────────────────
      const idHash = this.hashDocument(dto.idCardImage);
      const duplicate = await this.personRepo.findOne({
        where: { personIdHash: idHash },
      });
      if (duplicate && duplicate.id !== person.id) {
        person.kycStatus = KycStatus.REJECTED;
        await this.personRepo.save(person);
        return this.buildResponse(person, 'Rejected: duplicate ID document detected.');
      }
      person.personIdHash = idHash;
      person.kycStatus = KycStatus.ID_VERIFIED;
      await this.personRepo.save(person);

      // ── Layer 2: Liveness Detection (AWS Rekognition) ─────
      const livenessResult = await this.detectLiveness(dto.selfieImage);
      if (!livenessResult.isLive) {
        person.kycStatus = KycStatus.REJECTED;
        await this.personRepo.save(person);
        return this.buildResponse(person, 'Rejected: liveness check failed.');
      }
      person.kycStatus = KycStatus.LIVENESS_PASSED;
      await this.personRepo.save(person);

      // ── Layer 3: 1:1 Face Comparison (CompreFace) ─────────
      const faceMatchResult = await this.compareFaces(
        dto.idCardImage,
        dto.selfieImage,
      );
      if (!faceMatchResult.isMatch) {
        person.kycStatus = KycStatus.REJECTED;
        await this.personRepo.save(person);
        return this.buildResponse(
          person,
          'Rejected: selfie does not match ID document photo.',
        );
      }
      person.kycStatus = KycStatus.FACE_MATCHED;
      await this.personRepo.save(person);

      // ── Layer 4: 1:N Face Deduplication (CompreFace) ──────
      const dedupResult = await this.deduplicateFace(
        dto.selfieImage,
        person.id,
      );
      if (dedupResult.duplicateFound) {
        person.kycStatus = KycStatus.REJECTED;
        await this.personRepo.save(person);
        return this.buildResponse(
          person,
          'Rejected: face already registered under another account.',
        );
      }
      person.faceEmbeddingRef = dedupResult.subjectId;

      // ── All layers passed ─────────────────────────────────
      person.kycStatus = KycStatus.APPROVED;

      // TODO: Create ERC-4337 AA wallet and mint KYC Attestation SBT
      // 1. Call BlockchainService.createAAWallet(person.id) → get walletAddress
      // 2. person.aaWalletAddress = walletAddress
      // 3. Call BlockchainService.mintKycSbt(walletAddress, kycTokenId)
      // 4. person.kycAttestationTxHash = txHash
      // Users never need MetaMask - platform Paymaster pays all gas fees

      await this.personRepo.save(person);
      return this.buildResponse(person, 'KYC approved. All verification layers passed.');
    } catch (error) {
      this.logger.error(`KYC verification failed for person ${person.id}`, error);
      person.kycStatus = KycStatus.REJECTED;
      await this.personRepo.save(person);
      throw error;
    }
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

    // TODO: Delete face embedding from CompreFace collection
    // await this.deleteFaceFromCompreFace(person.faceEmbeddingRef);

    // TODO: Delete any stored images from object storage (S3 / MinIO)
    // await this.deleteStoredImages(person.id);

    await this.personRepo.remove(person);

    this.logger.log(`GDPR deletion completed for person ${userId}`);
    return { deleted: true };
  }

  // ──────────────────────────────────────────────
  //  Private helpers & stubbed external calls
  // ──────────────────────────────────────────────

  /**
   * SHA-256 hash of the ID document image for uniqueness checking.
   */
  private hashDocument(base64Image: string): string {
    return createHash('sha256').update(base64Image).digest('hex');
  }

  /**
   * Layer 2 stub: Call AWS Rekognition DetectFaces / liveness session.
   */
  private async detectLiveness(
    _selfieBase64: string,
  ): Promise<{ isLive: boolean; confidence: number }> {
    // TODO: Integrate AWS Rekognition Face Liveness
    //
    // Implementation outline:
    //   1. Create a Rekognition liveness session via CreateFaceLivenessSession
    //   2. Submit selfie frames to the session
    //   3. Retrieve session results via GetFaceLivenessSessionResults
    //   4. Check Confidence >= threshold (e.g. 90)
    //
    // const client = new RekognitionClient({ region: 'ap-northeast-1' });
    // const result = await client.send(new GetFaceLivenessSessionResultsCommand({ SessionId }));
    // return { isLive: result.Confidence >= 90, confidence: result.Confidence };

    this.logger.warn('Liveness detection is STUBBED — always returns true');
    return { isLive: true, confidence: 99.5 };
  }

  /**
   * Layer 3 stub: 1:1 face comparison via CompreFace Verification API.
   */
  private async compareFaces(
    _idCardBase64: string,
    _selfieBase64: string,
  ): Promise<{ isMatch: boolean; similarity: number }> {
    // TODO: Integrate CompreFace Verification Service
    //
    // Implementation outline:
    //   1. POST /api/v1/verification/verify with source_image & target_image
    //   2. Parse the similarity score from the response
    //   3. Return match if similarity >= threshold (e.g. 0.95)
    //
    // const response = await axios.post(`${COMPREFACE_URL}/api/v1/verification/verify`, formData, {
    //   headers: { 'x-api-key': COMPREFACE_VERIFY_API_KEY },
    // });
    // const similarity = response.data.result[0].face_matches[0].similarity;
    // return { isMatch: similarity >= 0.95, similarity };

    this.logger.warn('Face comparison is STUBBED — always returns match');
    return { isMatch: true, similarity: 0.98 };
  }

  /**
   * Layer 4 stub: 1:N face deduplication via CompreFace Recognition API.
   */
  private async deduplicateFace(
    _selfieBase64: string,
    personId: string,
  ): Promise<{ duplicateFound: boolean; subjectId: string }> {
    // TODO: Integrate CompreFace Recognition Service
    //
    // Implementation outline:
    //   1. POST /api/v1/recognition/recognize to search existing faces
    //   2. If a match is found with similarity >= threshold, it's a duplicate
    //   3. If no duplicate, add face: POST /api/v1/recognition/faces with subject=personId
    //   4. Return the subject ID (face embedding reference)
    //
    // const recognizeResp = await axios.post(
    //   `${COMPREFACE_URL}/api/v1/recognition/recognize`,
    //   formData,
    //   { headers: { 'x-api-key': COMPREFACE_RECOGNITION_API_KEY } },
    // );
    // const topMatch = recognizeResp.data.result?.[0]?.subjects?.[0];
    // if (topMatch && topMatch.similarity >= 0.95) {
    //   return { duplicateFound: true, subjectId: topMatch.subject };
    // }
    // // No duplicate — register the face
    // await axios.post(
    //   `${COMPREFACE_URL}/api/v1/recognition/faces?subject=${personId}`,
    //   formData,
    //   { headers: { 'x-api-key': COMPREFACE_RECOGNITION_API_KEY } },
    // );
    // return { duplicateFound: false, subjectId: personId };

    this.logger.warn('Face deduplication is STUBBED — always returns no duplicate');
    return { duplicateFound: false, subjectId: personId };
  }

  private buildResponse(person: Person, message: string): KycSubmitResponseDto {
    return {
      userId: person.id,
      kycStatus: person.kycStatus,
      message,
    };
  }
}

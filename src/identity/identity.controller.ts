import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { IdentityService } from './identity.service';
import { SubmitKycDto } from './dto/submit-kyc.dto';
import { KycStatusResponseDto, KycSubmitResponseDto } from './dto/kyc-status.dto';

@ApiTags('Identity / KYC')
@Controller('identity')
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Post('kyc')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit KYC verification',
    description:
      'Runs a 4-layer verification pipeline: ID uniqueness, liveness detection, ' +
      '1:1 face comparison, and 1:N face deduplication.',
  })
  @ApiResponse({ status: 200, description: 'KYC result', type: KycSubmitResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input or missing consent' })
  @ApiResponse({ status: 409, description: 'Duplicate identity detected' })
  async submitKyc(@Body() dto: SubmitKycDto): Promise<KycSubmitResponseDto> {
    return this.identityService.submitKyc(dto);
  }

  @Get('kyc/status/:userId')
  @ApiOperation({ summary: 'Get KYC verification status for a user' })
  @ApiParam({ name: 'userId', description: 'Person UUID', type: String })
  @ApiResponse({ status: 200, description: 'KYC status', type: KycStatusResponseDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getKycStatus(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<KycStatusResponseDto> {
    return this.identityService.getKycStatus(userId);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete user data (GDPR right-to-erasure)',
    description:
      'Removes all personal data associated with the user, including face embeddings ' +
      'and stored images.',
  })
  @ApiParam({ name: 'userId', description: 'Person UUID', type: String })
  @ApiResponse({ status: 200, description: 'Deletion confirmed' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deleteUserData(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<{ deleted: boolean }> {
    return this.identityService.deleteUserData(userId);
  }
}

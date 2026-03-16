import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    description: '真實姓名',
    example: '王小明',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  name: string;

  @ApiProperty({
    description: '暱稱',
    example: '小明',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  nickname: string;
}

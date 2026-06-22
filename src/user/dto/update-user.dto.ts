import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsString, IsNotEmpty } from "class-validator";

export class UpdateUserDto {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ example: 'John Doe' })
    @Transform(({ value }) => value?.trim())
    name!: string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({ example: 'john123' })
    @Transform(({ value }) => value?.trim())
    userName!: string;
}

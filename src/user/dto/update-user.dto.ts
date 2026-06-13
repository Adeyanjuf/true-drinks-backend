import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNotEmpty } from "class-validator";

export class UpdateUserDto {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ example: 'John Doe' })
    name!: string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({ example: 'john123' })
    userName!: string;
}

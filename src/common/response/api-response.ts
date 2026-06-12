export class ApiResponse<T> {
    statusCode!: number;
    message!: string;
    data?: T;
    error?: string;

    static success<T>(data: T, message = 'Success', statusCode = 200): ApiResponse<T> {
        return { statusCode, message, data };
    }

    static error(error: string, statusCode = 400): ApiResponse<null> {
        return { statusCode, message: error };
    }
}
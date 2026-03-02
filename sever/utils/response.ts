/**
 * Response Helper Utilities
 * Standardized API response format
 */

import { Response } from 'express';

// Response codes
export const ResponseCode = {
    SUCCESS: 0,
    ERROR: 1
} as const;

export type ResponseCodeType = typeof ResponseCode[keyof typeof ResponseCode];

// PayOS codes (for webhook responses)
export const PayOSCode = {
    SUCCESS: '00',
    INVALID_SIGNATURE: '01',
    PAYMENT_NOT_FOUND: '02',
    GENERAL_ERROR: '99'
} as const;

/**
 * Send success response
 */
export const successResponse = (
    res: Response, 
    data: any, 
    message: string = 'Success',
    statusCode: number = 200
) => {
    return res.status(statusCode).json({
        code: ResponseCode.SUCCESS,
        message,
        ...data
    });
};

/**
 * Send error response
 */
export const errorResponse = (
    res: Response,
    message: string = 'Error',
    error?: any,
    statusCode: number = 400
) => {
    const response: any = {
        code: ResponseCode.ERROR,
        message
    };
    
    if (error) {
        response.error = error;
    }
    
    return res.status(statusCode).json(response);
};

/**
 * Send server error response
 */
export const serverError = (
    res: Response,
    message: string = 'Lỗi server',
    error?: any
) => {
    console.error('Server Error:', error?.message || error);
    return errorResponse(res, message, error, 500);
};

/**
 * Send PayOS webhook response (always 200 with code '00')
 */
export const webhookResponse = (
    res: Response,
    message: string = 'Received'
) => {
    return res.status(200).json({
        code: PayOSCode.SUCCESS,
        message
    });
};

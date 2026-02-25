import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { TokenPayload } from '../types';

interface AuthRequest extends Request {
    user?: TokenPayload;
}

const auth = (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Token không tồn tại' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Token không hợp lệ' });
    }
};

export default auth;

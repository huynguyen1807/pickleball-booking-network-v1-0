import { Request } from 'express';
import { JwtPayload } from 'jsonwebtoken';

export interface User {
  id: number;
  username: string;
  email: string;
  role: 'player' | 'owner' | 'admin';
  full_name?: string;
  phone?: string;
  skill_level?: string;
  business_license_url?: string;
  is_verified?: boolean;
  created_at: Date;
}

export interface AuthRequest extends Request {
  user?: User;
}

export interface TokenPayload extends JwtPayload {
  userId: number;
  role: string;
}

export interface Court {
  id: number;
  name: string;
  description?: string;
  location: string;
  number_of_small_court: number;
  owner_id: number;
  status: 'active' | 'inactive';
  created_at: Date;
}

export interface Booking {
  id: number;
  court_id: number;
  user_id: number;
  start_time: Date;
  end_time: Date;
  total_price: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  created_at: Date;
}

export interface Match {
  id: number;
  creator_id: number;
  court_id?: number;
  match_date: Date;
  max_players: number;
  skill_level?: string;
  description?: string;
  status: 'open' | 'full' | 'completed' | 'cancelled';
  created_at: Date;
}

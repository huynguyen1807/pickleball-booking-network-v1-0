export interface User {
  id: number;
  email: string;
  full_name: string;
  phone?: string;
  avatar?: string;
  role: 'user' | 'owner' | 'admin';
  skill_level?: string;
  status: 'active' | 'inactive' | 'pending';
  latitude?: number;
  longitude?: number;
  created_at?: string;
}

export interface Court {
  id: number;
  name: string;
  description?: string;
  location: string;
  number_of_small_court: number;
  owner_id: number;
  status: 'active' | 'inactive';
  images?: string;
  amenities?: string;
  avg_rating?: number;
  reviews_count?: number;
}

export interface Booking {
  id: number;
  court_id: number;
  user_id: number;
  start_time: string;
  end_time: string;
  total_price: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  created_at: string;
  court?: Court;
  user?: User;
}

export interface Match {
  id: number;
  creator_id: number;
  court_id?: number;
  match_date: string;
  max_players: number;
  current_players: number;
  skill_level?: string;
  description?: string;
  status: 'open' | 'full' | 'completed' | 'cancelled';
  created_at: string;
  creator?: User;
  court?: Court;
}

export interface Post {
  id: number;
  user_id: number;
  content: string;
  created_at: string;
  user?: User;
}

export interface ChatMessage {
  id: number;
  chat_room_id: number;
  user_id: number;
  content: string;
  created_at: string;
  full_name?: string;
  avatar?: string;
  is_read?: boolean;
}


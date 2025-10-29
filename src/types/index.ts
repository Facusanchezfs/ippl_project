export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'professional' | 'content_manager' | 'financial';
  profilePicture?: string;
  isActive: boolean;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  slug: string;
  author: User;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  isPublished: boolean;
  featuredImage?: string;
  tags: string[];
}

export interface PsychologistProfile {
  id: string;
  userId: string;
  specialty: string;
  education: string[];
  experience: string[];
  consultationTypes: ('presencial' | 'online' | 'domicilio')[];
  contactInfo: {
    phone?: string;
    email: string;
    address?: string;
  };
  bio: string;
  schedule?: {
    day: string;
    hours: string;
  }[];
}

export type AuthState = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
};
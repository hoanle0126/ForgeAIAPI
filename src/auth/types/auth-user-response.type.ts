export interface AuthUserResponse {
  id: string;
  fullName: string;
  email: string;
  gender: 'male' | 'female';
  dateOfBirth: string;
  createdAt: string;
}

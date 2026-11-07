import mongoose, { Document, Schema } from 'mongoose';

export type UserRole = 'elder' | 'family';

export interface IUser extends Document {
  name: string;
  role: UserRole;
  email?: string;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, required: true, enum: ['elder', 'family'] },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', UserSchema);


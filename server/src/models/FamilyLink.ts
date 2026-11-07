import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IFamilyLink extends Document {
  elderId: Types.ObjectId;
  familyId: Types.ObjectId;
  amountLimit: number;
  createdAt: Date;
  updatedAt: Date;
}

const FamilyLinkSchema = new Schema<IFamilyLink>(
  {
    elderId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    familyId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amountLimit: { type: Number, default: 100 },
  },
  { timestamps: true }
);

export const FamilyLink = mongoose.model<IFamilyLink>('FamilyLink', FamilyLinkSchema);


import mongoose, { Document, Schema, Types } from 'mongoose';

export type PaymentRisk = 'LOW' | 'MEDIUM' | 'HIGH';

export type PaymentStatus =
  | 'CHECKED'
  | 'CREATED'
  | 'AUTHORIZED'
  | 'HELD'
  | 'PROCESSING'
  | 'CAPTURED'
  | 'VOIDED'
  | 'FAILED';

export type PaymentDecision = 'APPROVED' | 'DECLINED' | 'EXPIRED' | null;

export interface IRulesResult {
  risk: PaymentRisk;
  flags: string[];
}

export interface IAiResult {
  risk: PaymentRisk;
  scamType: string;
  reasons: string[];
  questionForElder: string;
  familySummary: string;
}

export interface IPayment extends Document {
  elderId: Types.ObjectId;
  familyId: Types.ObjectId;
  amount: number;
  currency: string;
  payeeLabel: string;
  message: string;
  rulesResult: IRulesResult;
  aiResult: IAiResult;
  aiFailed: boolean;
  risk: PaymentRisk;
  paypalOrderId?: string;
  paypalAuthorizationId?: string;
  paypalCaptureId?: string;
  status: PaymentStatus;
  holdToken: string;
  expiresAt?: Date;
  decision: PaymentDecision;
  decidedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    elderId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    familyId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD', uppercase: true },
    payeeLabel: { type: String, required: true, trim: true },
    message: { type: String, default: '', trim: true },
    rulesResult: {
      risk: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'LOW' },
      flags: { type: [String], default: [] },
    },
    aiResult: {
      risk: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'LOW' },
      scamType: { type: String, default: 'none' },
      reasons: { type: [String], default: [] },
      questionForElder: { type: String, default: '' },
      familySummary: { type: String, default: '' },
    },
    aiFailed: { type: Boolean, default: false },
    risk: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], required: true },
    paypalOrderId: { type: String, index: true },
    paypalAuthorizationId: { type: String, index: true },
    paypalCaptureId: { type: String },
    status: {
      type: String,
      enum: [
        'CHECKED',
        'CREATED',
        'AUTHORIZED',
        'HELD',
        'PROCESSING',
        'CAPTURED',
        'VOIDED',
        'FAILED',
      ],
      default: 'CHECKED',
      index: true,
    },
    holdToken: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, index: true },
    decision: {
      type: String,
      enum: ['APPROVED', 'DECLINED', 'EXPIRED', null],
      default: null,
    },
    decidedAt: { type: Date },
  },
  { timestamps: true }
);

export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);


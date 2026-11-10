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
  riskScore?: number;
  tactics?: string[];
  explanation?: string;
  source?: string;
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
  paypalAuthorizationRequestId?: string;
  paypalCaptureRequestId?: string;
  paypalVoidRequestId?: string;
  paypalCaptureId?: string;
  status: PaymentStatus;
  processingAction?: 'CREATE_ORDER' | 'AUTHORIZE' | 'CAPTURE' | 'VOID' | null;
  processingStartedAt?: Date | null;
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
      riskScore: { type: Number },
      tactics: { type: [String], default: [] },
      explanation: { type: String, default: '' },
      source: { type: String, default: 'fallback' },
    },
    aiFailed: { type: Boolean, default: false },
    risk: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], required: true },
    paypalOrderId: { type: String, index: true },
    paypalAuthorizationId: { type: String, index: true },
    paypalAuthorizationRequestId: { type: String },
    paypalCaptureRequestId: { type: String },
    paypalVoidRequestId: { type: String },
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
    processingAction: {
      type: String,
      enum: ['CREATE_ORDER', 'AUTHORIZE', 'CAPTURE', 'VOID', null],
      default: null,
      index: true,
    },
    processingStartedAt: { type: Date, index: true },
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


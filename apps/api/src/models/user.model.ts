import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const userSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    role: { type: String, enum: ['user', 'admin'], default: 'user', required: true },
    profileVersion: { type: Number, default: 0, min: 0, required: true },
    overrides: {
      mutedGenres: { type: [String], default: [] },
      pinnedAspects: { type: [String], default: [] },
      disabledAi: { type: Boolean, default: false },
    },
    onboardedAt: { type: Date, default: null },
    failedLogins: { type: Number, default: 0, select: false },
    lockedUntil: { type: Date, default: null, select: false },
  },
  { timestamps: true },
);

userSchema.index({ email: 1 }, { unique: true });

export type User = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<User>;
export const UserModel = model('User', userSchema);

import { randomBytes } from 'crypto';

export const generateUserSecret = () => randomBytes(32).toString('hex');
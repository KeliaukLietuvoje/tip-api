import jwt, { VerifyErrors } from 'jsonwebtoken';
import { Tenant } from '../services/tenants.service';

export function verifyToken(token: string) {
  return new Promise<Tenant | undefined>((resolve, reject) => {
    jwt.verify(
      token,
      process.env.JWT_SECRET,
      (err: VerifyErrors | null, decoded?: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(decoded);
        }
      }
    );
  });
}
export async function generateToken(
  payload: any,
  expiresIn: number = 60 * 60 * 24
) {
  // by default it expires in 24 hours
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn,
  });
}

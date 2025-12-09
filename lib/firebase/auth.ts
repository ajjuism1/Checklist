import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth } from './config';
import { User } from '@/types';

const ALLOWED_DOMAIN = 'appmaker.xyz';

export const signInWithGoogle = async (): Promise<User> => {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const user = result.user;

  // Check domain restriction
  if (!user.email || !user.email.endsWith(`@${ALLOWED_DOMAIN}`)) {
    await firebaseSignOut(auth);
    throw new Error(`Access denied. Only @${ALLOWED_DOMAIN} emails are allowed.`);
  }

  // Determine user role
  const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',') || [];
  const role: 'admin' | 'team_member' = adminEmails.includes(user.email)
    ? 'admin'
    : 'team_member';

  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    role,
  };
};

export const signOut = async (): Promise<void> => {
  await firebaseSignOut(auth);
};

export const getCurrentUser = (): FirebaseUser | null => {
  return auth.currentUser;
};


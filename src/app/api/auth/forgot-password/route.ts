import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { user, passwordResetTokens } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { sendPasswordResetEmail } from '@/lib/email';

const GENERIC_MESSAGE = 'If an account exists with that email, you will receive a reset link.';

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: true, message: GENERIC_MESSAGE },
        { status: 200 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Must be valid email format (contains @) and not a phone placeholder
    if (!trimmedEmail.includes('@') || trimmedEmail.endsWith('@phone.placeholder')) {
      return NextResponse.json(
        { success: true, message: GENERIC_MESSAGE },
        { status: 200 }
      );
    }

    // Look up user by email (must have real email, not phone placeholder)
    const [foundUser] = await db
      .select()
      .from(user)
      .where(eq(user.email, trimmedEmail))
      .limit(1);

    if (!foundUser || !foundUser.email?.includes('@') || foundUser.email.endsWith('@phone.placeholder')) {
      return NextResponse.json(
        { success: true, message: GENERIC_MESSAGE },
        { status: 200 }
      );
    }

    // User must have a password (credentials account)
    if (!foundUser.password) {
      return NextResponse.json(
        { success: true, message: GENERIC_MESSAGE },
        { status: 200 }
      );
    }

    // Delete any existing reset tokens for this email
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.email, trimmedEmail));

    // Generate secure token
    const token = randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(token, 10);
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const resetUrl = `${baseUrl}/reset-password?token=${token}&email=${encodeURIComponent(trimmedEmail)}`;

    await db.insert(passwordResetTokens).values({
      id: uuidv4(),
      email: trimmedEmail,
      token: hashedToken,
      expires,
    });

    try {
      await sendPasswordResetEmail(trimmedEmail, resetUrl);
    } catch (err) {
      console.error('Error sending password reset email:', err);
      // Don't reveal failure - still return generic success
    }

    return NextResponse.json(
      { success: true, message: GENERIC_MESSAGE },
      { status: 200 }
    );
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { success: true, message: GENERIC_MESSAGE },
      { status: 200 }
    );
  }
}

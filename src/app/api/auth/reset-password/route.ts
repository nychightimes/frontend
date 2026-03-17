import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { user, passwordResetTokens } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

export async function POST(req: Request) {
  try {
    const { email, token, newPassword } = await req.json();

    if (!email || !token || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired reset link.' },
        { status: 400 }
      );
    }

    const trimmedEmail = (email as string).trim().toLowerCase();
    const trimmedToken = (token as string).trim();

    if (!trimmedEmail || !trimmedToken || trimmedEmail.endsWith('@phone.placeholder')) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired reset link.' },
        { status: 400 }
      );
    }

    // Password validation
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters.' },
        { status: 400 }
      );
    }

    const now = new Date();

    // Find valid token: matching email and not expired
    const [resetRow] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.email, trimmedEmail))
      .limit(1);

    if (!resetRow || resetRow.expires < now) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired reset link.' },
        { status: 400 }
      );
    }

    const isValidToken = await bcrypt.compare(trimmedToken, resetRow.token);
    if (!isValidToken) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired reset link.' },
        { status: 400 }
      );
    }

    // Update user password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db
      .update(user)
      .set({ password: hashedPassword, updatedAt: now })
      .where(eq(user.email, trimmedEmail));

    // Delete the used token
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, resetRow.id));

    return NextResponse.json(
      { success: true, message: 'Password has been reset. You can now sign in.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { success: false, error: 'Invalid or expired reset link.' },
      { status: 400 }
    );
  }
}

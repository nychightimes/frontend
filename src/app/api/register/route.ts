// app/api/register/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { user } from '@/lib/schema';
import { eq, or } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { globalMagicLink, magicLinkUsage } from '@/lib/schema';
import { v4 as uuidv4 } from 'uuid';
import { sendWelcomeEmail } from '@/lib/email';

export async function POST(req: Request) {
  const { email, password, name, note, magicToken } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: 'Email or phone number and password are required.' }, { status: 400 });
  }

  if (!name) {
    return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
  }

  // Detect if input is email or phone
  const isEmail = email.includes('@');
  
  // Check if user already exists (check both email and phone fields)
  let existingUser;
  if (isEmail) {
    [existingUser] = await db.select().from(user).where(eq(user.email, email));
  } else {
    [existingUser] = await db.select().from(user).where(eq(user.phone, email));
  }

  if (existingUser) {
    return NextResponse.json({ 
      error: 'An account with this email or phone number already exists.' 
    }, { status: 400 });
  }

  // Check if magic token is provided and valid
  let isMagicLinkValid = false;
  let magicLinkData = null;
  
  if (magicToken) {
    const magicLink = await db
      .select()
      .from(globalMagicLink)
      .where(eq(globalMagicLink.token, magicToken))
      .limit(1);
    
    if (magicLink.length > 0 && magicLink[0].isEnabled) {
      isMagicLinkValid = true;
      magicLinkData = magicLink[0];
    }
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Insert new user with appropriate status
  const userData: any = {
    id: uuidv4(),
    name: name || null,
    note: note || null,
    password: hashedPassword,
    status: isMagicLinkValid ? 'approved' : 'pending',
  };

  // Set email or phone based on input type
  if (isEmail) {
    userData.email = email;
    // Send welcome email only if it's an email registration
    try {
      await sendWelcomeEmail(email, name || undefined);
    } catch (error) {
      console.error('Error sending welcome email:', error);
      // Don't fail registration if email fails
    }
  } else {
    userData.phone = email;
    // For phone registration, we need to provide a placeholder email or make it nullable
    userData.email = `${email.replace(/[^0-9]/g, '')}@phone.placeholder`; // Placeholder email
  }

  await db.insert(user).values(userData);

  // Track magic link usage if it was used
  if (isMagicLinkValid && magicLinkData) {
    await db.insert(magicLinkUsage).values({
      id: uuidv4(),
      userId: userData.id,
      magicLinkId: magicLinkData.id,
      ipAddress: null, // You can get this from headers if needed
      userAgent: null, // You can get this from headers if needed
    });
  }

  if (isMagicLinkValid) {
    return NextResponse.json({ 
      success: true, 
      message: 'Account created and automatically approved via magic link! You can now login.',
      requiresApproval: false,
      autoApproved: true
    });
  } else {
    return NextResponse.json({ 
      success: true, 
      message: 'Account created successfully! Your account is pending approval. You will be able to login once an admin approves your account.',
      requiresApproval: true 
    });
  }
}

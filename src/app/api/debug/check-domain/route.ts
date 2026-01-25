import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { domainVerification } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { domain } = body;

    if (!domain) {
      return NextResponse.json({
        success: false,
        error: 'Domain is required'
      }, { status: 400 });
    }

    console.log('Domain verification check requested for:', domain);

    // Check database first for recent verification
    const existingVerification = await db
      .select()
      .from(domainVerification)
      .where(eq(domainVerification.domain, domain))
      .limit(1);

    if (existingVerification.length > 0) {
      const verification = existingVerification[0];
      const lastVerifiedAt = new Date(verification.lastVerifiedAt).getTime();
      const timeSinceLastCheck = Date.now() - lastVerifiedAt;

      // If verified within last 30 days and status is valid, return cached result
      if (timeSinceLastCheck < THIRTY_DAYS_MS && verification.verificationStatus === 'valid') {
        const daysSinceCheck = Math.round(timeSinceLastCheck / 1000 / 60 / 60 / 24);
        console.log(`Domain verification: Using cached DB result - last check was ${daysSinceCheck} day(s) ago`);

        return NextResponse.json({
          success: true,
          result: {
            exists: true,
            domain: verification.domain,
            client: {
              status: verification.clientStatus,
              subscriptionStatus: verification.subscriptionStatus,
              subscriptionEndDate: verification.subscriptionEndDate,
            },
            cached: true,
            lastVerifiedAt: verification.lastVerifiedAt,
          }
        });
      }
    }

    // If no recent verification, check with admin panel
    const adminPanelUrl = process.env.ADMIN_PANEL_URL || process.env.NEXT_PUBLIC_ADMIN_PANEL_URL || 'http://localhost:3000';
    const url = `${adminPanelUrl}/api/saas/check-domain`;

    console.log('Performing fresh domain check with admin panel:', { domain, adminPanelUrl });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ domain }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({
        success: false,
        error: `Admin panel responded with status ${response.status}: ${errorText}`,
        status: response.status
      });
    }

    const result = await response.json();

    // If verification successful, store/update in database
    if (result.exists && result.client) {
      const client = result.client;
      const now = new Date();

      if (existingVerification.length > 0) {
        // Update existing record
        await db
          .update(domainVerification)
          .set({
            lastVerifiedAt: now,
            verificationStatus: 'valid',
            clientStatus: client.status,
            subscriptionStatus: client.subscriptionStatus,
            subscriptionEndDate: client.subscriptionEndDate ? new Date(client.subscriptionEndDate) : null,
            metadata: result,
            updatedAt: now,
          })
          .where(eq(domainVerification.domain, domain));

        console.log('Domain verification: Updated existing DB record for', domain);
      } else {
        // Insert new record
        await db.insert(domainVerification).values({
          id: uuidv4(),
          domain,
          lastVerifiedAt: now,
          verificationStatus: 'valid',
          clientStatus: client.status,
          subscriptionStatus: client.subscriptionStatus,
          subscriptionEndDate: client.subscriptionEndDate ? new Date(client.subscriptionEndDate) : null,
          metadata: result,
          createdAt: now,
          updatedAt: now,
        });

        console.log('Domain verification: Created new DB record for', domain);
      }
    }

    return NextResponse.json({
      success: true,
      result: result,
      cached: false,
    });

  } catch (error) {
    console.error('Domain check error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

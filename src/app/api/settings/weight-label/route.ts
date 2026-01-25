import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { settings } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const weightLabelSetting = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'weight_label'))
      .limit(1);

    return NextResponse.json({
      success: true,
      weightLabel: weightLabelSetting.length > 0 ? weightLabelSetting[0].value : 'g' // Default to grams
    });
  } catch (error) {
    console.error('Error fetching weight label setting:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch weight label setting', weightLabel: 'g' },
      { status: 500 }
    );
  }
}


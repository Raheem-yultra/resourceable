import { NextRequest, NextResponse } from 'next/server';
import { userService } from '@/services/user.service';
import { businessService } from '@/services/business.service';
import { signUpSchema } from '@/lib/validations';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validatedData = signUpSchema.parse(body);

    // Check if user already exists
    const existingUser = await userService.getUserByEmail(validatedData.email);
    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      );
    }

    // Create user
    const user = await userService.createUser({
      email: validatedData.email,
      password: validatedData.password,
      name: validatedData.name,
      role: validatedData.role,
    });

    // If business role, create business profile
    if (validatedData.role === 'BUSINESS') {
      await businessService.createBusiness(user.id, {
        businessName: validatedData.name || 'Unnamed Business',
        zipCode: validatedData.zipCode,
      });
    }

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Signup error:', error);
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    // Prisma connection error
    if (error.code === 'P1001') {
      return NextResponse.json(
        { error: 'Database connection failed. Please try again later.' },
        { status: 503 }
      );
    }

    // Prisma unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create account. Please try again.' },
      { status: 500 }
    );
  }
}

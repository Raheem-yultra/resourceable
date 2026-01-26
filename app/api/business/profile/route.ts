import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { businessService } from '@/services/business.service';
import { businessProfileSchema } from '@/lib/validations';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const business = await businessService.getBusinessByUserId(session.user.id);
    
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    return NextResponse.json({ business });
  } catch (error) {
    console.error('Get business error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'BUSINESS') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    
    // Basic validation for required fields
    if (!body.businessName || body.businessName.trim().length < 2) {
      return NextResponse.json(
        { error: 'Business name is required and must be at least 2 characters' },
        { status: 400 }
      );
    }

    // Sanitize and validate numeric inputs
    const yearEstablished = body.yearEstablished ? parseInt(body.yearEstablished) : null;
    if (yearEstablished && (yearEstablished < 1800 || yearEstablished > new Date().getFullYear())) {
      return NextResponse.json(
        { error: 'Invalid year established' },
        { status: 400 }
      );
    }

    const priceMin = body.priceMin ? parseFloat(body.priceMin) : null;
    const priceMax = body.priceMax ? parseFloat(body.priceMax) : null;
    
    if (priceMin && priceMin < 0) {
      return NextResponse.json({ error: 'Minimum price cannot be negative' }, { status: 400 });
    }
    if (priceMax && priceMax < 0) {
      return NextResponse.json({ error: 'Maximum price cannot be negative' }, { status: 400 });
    }
    if (priceMin && priceMax && priceMin > priceMax) {
      return NextResponse.json({ error: 'Minimum price cannot exceed maximum price' }, { status: 400 });
    }
    
    // Update or create business profile
    const business = await prisma.business.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        businessName: body.businessName.trim(),
        businessType: body.businessType?.trim() || null,
        description: body.description?.trim() || null,
        phone: body.phone?.trim() || null,
        email: body.email?.trim() || null,
        website: body.website?.trim() || null,
        address: body.address?.trim() || null,
        addressLine2: body.addressLine2?.trim() || null,
        city: body.city?.trim() || null,
        state: body.state?.trim() || null,
        zipCode: body.zipCode?.trim() || null,
        yearEstablished,
        licenseNumber: body.licenseNumber?.trim() || null,
      },
      update: {
        businessName: body.businessName.trim(),
        businessType: body.businessType?.trim() || null,
        description: body.description?.trim() || null,
        phone: body.phone?.trim() || null,
        email: body.email?.trim() || null,
        website: body.website?.trim() || null,
        address: body.address?.trim() || null,
        addressLine2: body.addressLine2?.trim() || null,
        city: body.city?.trim() || null,
        state: body.state?.trim() || null,
        zipCode: body.zipCode?.trim() || null,
        yearEstablished,
        licenseNumber: body.licenseNumber?.trim() || null,
      },
    });

    // Check if service already exists
    const existingService = await prisma.service.findFirst({
      where: { businessId: business.id },
    });

    const serviceSlug = body.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    const capacity = body.capacity ? parseInt(body.capacity) : null;
    if (capacity && capacity < 0) {
      return NextResponse.json({ error: 'Capacity cannot be negative' }, { status: 400 });
    }
    
    const serviceData = {
      name: `${body.businessName} Services`,
      slug: serviceSlug,
      description: body.description?.trim() || 'Professional services',
      priceRange: body.priceRange || 'CONTACT',
      priceMin,
      priceMax,
      pricingDetails: body.pricingDetails?.trim() || null,
      ageGroups: Array.isArray(body.ageGroups) ? body.ageGroups : [],
      capacity,
      insuranceAccepted: body.insuranceAccepted === true || body.insuranceAccepted === 'true',
      insuranceProviders: body.acceptedInsurances 
        ? body.acceptedInsurances.split(',').map((i: string) => i.trim()).filter(Boolean)
        : [],
    };

    let service;
    if (existingService) {
      service = await prisma.service.update({
        where: { id: existingService.id },
        data: serviceData,
      });
    } else {
      service = await prisma.service.create({
        data: {
          ...serviceData,
          businessId: business.id,
        },
      });
    }

    // Handle service types mapping
    if (body.serviceTypes && body.serviceTypes.length > 0) {
      // Delete existing mappings
      await prisma.serviceTypeMap.deleteMany({
        where: { serviceId: service.id },
      });

      // Create new mappings
      for (const typeSlug of body.serviceTypes) {
        const serviceType = await prisma.serviceType.findUnique({
          where: { slug: typeSlug },
        });

        if (serviceType) {
          await prisma.serviceTypeMap.create({
            data: {
              serviceId: service.id,
              serviceTypeId: serviceType.id,
            },
          });
        }
      }
    }

    // Handle disabilities
    if (body.disabilityTypes && body.disabilityTypes.length > 0) {
      // Delete existing relationships
      await prisma.businessDisability.deleteMany({
        where: { businessId: business.id },
      });

      // Create new relationships
      for (const disabilitySlug of body.disabilityTypes) {
        const disability = await prisma.disability.findUnique({
          where: { slug: disabilitySlug },
        });

        if (disability) {
          await prisma.businessDisability.create({
            data: {
              businessId: business.id,
              disabilityId: disability.id,
            },
          });
        }
      }
    }

    return NextResponse.json({ business: business, success: true });
  } catch (error: any) {
    console.error('Update business error:', error);
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

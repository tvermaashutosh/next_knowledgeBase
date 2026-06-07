import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/supabase-server";
import { getUserByEmail, canReview } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

// GET: List reviews (with filters)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // pending, approved, rejected
    const featureId = searchParams.get("featureId");

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (featureId) where.featureId = featureId;

    const reviews = await prisma.review.findMany({
      where,
      include: {
        feature: {
          select: { title: true, slug: true, module: { select: { name: true, slug: true } } },
        },
        reviewer: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(reviews);
  } catch (error) {
    console.error("Reviews GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Submit / Approve / Reject
export async function POST(request: NextRequest) {
  try {
    const supaUser = await getUser();
    if (!supaUser?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appUser = await getUserByEmail(supaUser.email);
    if (!appUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      // ─── Submit for Review ────────────────────────────
      case "submit": {
        const { featureId } = body;
        if (!featureId) return NextResponse.json({ error: "Missing featureId" }, { status: 400 });

        // Update feature status to REVIEW
        await prisma.feature.update({
          where: { id: featureId },
          data: { status: "REVIEW" },
        });

        // Create review record
        const review = await prisma.review.create({
          data: {
            featureId,
            submittedBy: appUser.email,
            status: "pending",
          },
        });

        await logAudit(appUser.id, "submitted", "feature", featureId, `Submitted for review by ${appUser.name}`);

        return NextResponse.json({ success: true, review });
      }

      // ─── Approve ──────────────────────────────────────
      case "approve": {
        const { reviewId, comments } = body;
        if (!reviewId) return NextResponse.json({ error: "Missing reviewId" }, { status: 400 });

        if (!canReview(appUser.role)) {
          return NextResponse.json({ error: "Only Reviewers and Admins can approve" }, { status: 403 });
        }

        const review = await prisma.review.update({
          where: { id: reviewId },
          data: {
            status: "approved",
            reviewedBy: appUser.id,
            comments: comments || null,
          },
        });

        // Update feature status to APPROVED
        await prisma.feature.update({
          where: { id: review.featureId },
          data: { status: "APPROVED" },
        });

        await logAudit(appUser.id, "approved", "feature", review.featureId, `Approved by ${appUser.name}${comments ? `: ${comments}` : ""}`);

        return NextResponse.json({ success: true, review });
      }

      // ─── Reject ───────────────────────────────────────
      case "reject": {
        const { reviewId: rId, comments: rComments } = body;
        if (!rId) return NextResponse.json({ error: "Missing reviewId" }, { status: 400 });
        if (!rComments) return NextResponse.json({ error: "Comments required for rejection" }, { status: 400 });

        if (!canReview(appUser.role)) {
          return NextResponse.json({ error: "Only Reviewers and Admins can reject" }, { status: 403 });
        }

        const review = await prisma.review.update({
          where: { id: rId },
          data: {
            status: "rejected",
            reviewedBy: appUser.id,
            comments: rComments,
          },
        });

        // Revert feature status to DRAFT
        await prisma.feature.update({
          where: { id: review.featureId },
          data: { status: "DRAFT" },
        });

        await logAudit(appUser.id, "rejected", "feature", review.featureId, `Rejected by ${appUser.name}: ${rComments}`);

        return NextResponse.json({ success: true, review });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Reviews POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { config as loadEnv } from "dotenv"
loadEnv({ path: ".env.development.local" })
loadEnv()

import mongoose from "mongoose"
import { connectToDatabase } from "../lib/db/mongoose"
import { CaseStudy, Client, Page } from "../models"
import { CASE_STUDIES, CLIENTS } from "./seed-data"

const LISTING_PAGE = {
  slug: "case-studies",
  title: "Case Studies",
  heroEyebrow: "Case studies & clients",
  heroTitle: "Transport programmes that keep organisations moving",
  heroSubtitle:
    "Real outcomes for enterprises, free-zone companies and event organisers who rely on ViaRidez to move their people safely and on time.",
}

function validateSeedData() {
  if (CASE_STUDIES.length === 0) {
    throw new Error("No case studies were found in scripts/seed-data.ts.")
  }

  const slugs = CASE_STUDIES.map((study) => study.slug)
  if (slugs.some((slug) => !slug?.trim())) {
    throw new Error("Every case study must have a non-empty slug.")
  }
  if (new Set(slugs).size !== slugs.length) {
    throw new Error("Duplicate case-study slugs were found in scripts/seed-data.ts.")
  }

  const clientNames = CLIENTS.map((client) => client.name)
  if (new Set(clientNames).size !== clientNames.length) {
    throw new Error("Duplicate client names were found in scripts/seed-data.ts.")
  }
}

async function seedCaseStudies() {
  validateSeedData()
  await connectToDatabase()

  console.log("Connected to MongoDB. Syncing ViaRidez case studies...")

  // Upsert clients without replacing logo / website fields managed in the CMS.
  for (const [index, client] of CLIENTS.entries()) {
    await Client.updateOne(
      { name: client.name },
      {
        $set: {
          name: client.name,
          industry: client.industry,
          order: index,
          featured: index < 4,
          status: "published",
          isDeleted: false,
        },
      },
      { upsert: true, runValidators: true },
    )
  }

  // Upsert the project-defined studies by slug; unrelated CMS-created studies remain in place.
  for (const [index, study] of CASE_STUDIES.entries()) {
    await CaseStudy.updateOne(
      { slug: study.slug },
      {
        $set: {
          title: study.title,
          slug: study.slug,
          client: study.client,
          industry: study.industry,
          serviceType: study.serviceType,
          location: study.location,
          fleetSize: study.fleetSize,
          duration: study.duration,
          excerpt: study.excerpt,
          coverImage: study.coverImage,
          challenge: study.challenge,
          solution: study.solution,
          result: study.result,
          services: study.services,
          highlights: study.highlights,
          metrics: study.metrics,
          gallery: study.gallery,
          tags: study.tags,
          testimonialQuote: study.testimonialQuote,
          testimonialAuthor: study.testimonialAuthor,
          testimonialRole: study.testimonialRole,
          featured: Boolean(study.featured),
          order: study.order ?? index,
          seo: {
            metaTitle: study.metaTitle,
            metaDescription: study.metaDescription,
          },
          status: "published",
          isDeleted: false,
        },
      },
      { upsert: true, runValidators: true },
    )
  }

  // Create the listing page's editable hero content only when it does not exist.
  await Page.updateOne(
    { slug: LISTING_PAGE.slug },
    {
      $setOnInsert: {
        ...LISTING_PAGE,
        body: "",
        sections: [],
        status: "published",
        isDeleted: false,
      },
    },
    { upsert: true, runValidators: true },
  )

  const [publishedCaseStudies, publishedClients] = await Promise.all([
    CaseStudy.countDocuments({ status: "published", isDeleted: false }),
    Client.countDocuments({ status: "published", isDeleted: false }),
  ])

  console.log(`Synced ${CASE_STUDIES.length} seeded case studies and ${CLIENTS.length} seeded clients.`)
  console.log(`Published totals: ${publishedCaseStudies} case studies, ${publishedClients} clients.`)
  console.log("Additional CMS-created studies and existing client logo / website values were preserved.")
}

seedCaseStudies()
  .catch((error) => {
    console.error("Case-study seeding failed:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })

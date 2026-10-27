import bcrypt from "bcryptjs";
import { db } from "./db";
import {
  admins,
  categories,
  products,
  productImages,
  couriers,
  coupons,
} from "../schemas/index";
import { eq } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config();

async function seed() {
  try {
    console.log("🌱 Starting Nijer Bazaar database seed...");

    // 1. Default Admin
    const existingAdmin = await db
      .select()
      .from(admins)
      .where(eq(admins.email, "admin@nijerbazaar.com"))
      .limit(1);

    if (existingAdmin.length === 0) {
      const hashedPassword = await bcrypt.hash("admin123456", 12);
      await db.insert(admins).values({
        name: "Nijer Bazaar Admin",
        email: "admin@nijerbazaar.com",
        password: hashedPassword,
        role: "super_admin",
        isActive: true,
      });
      console.log("✅ Admin created (admin@nijerbazaar.com / admin123456)");
    } else {
      console.log("ℹ️  Admin account already exists");
    }

    // 2. Categories
    const existingCats = await db.select().from(categories).limit(1);
    if (existingCats.length === 0) {
      const insertedCats = await db
        .insert(categories)
        .values([
          { name: "Electronics", slug: "electronics", sortOrder: 1, isFeatured: true, image: "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400&q=80" },
          { name: "Fashion", slug: "fashion", sortOrder: 2, isFeatured: true, image: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=400&q=80" },
          { name: "Home & Living", slug: "home-living", sortOrder: 3, isFeatured: true, image: "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=400&q=80" },
          { name: "Beauty & Health", slug: "beauty-health", sortOrder: 4, isFeatured: true, image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&q=80" },
          { name: "Sports", slug: "sports-outdoors", sortOrder: 5, isFeatured: false, image: "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=400&q=80" },
          { name: "Toys", slug: "toys-kids", sortOrder: 6, isFeatured: false, image: "https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=400&q=80" },
        ])
        .returning();

      const catMap = Object.fromEntries(insertedCats.map((c) => [c.slug, c.id]));

      // 3. Sample Products
      const sampleProducts = [
        {
          name: "ANC Wireless Bluetooth Earbuds Pro",
          slug: "anc-wireless-bluetooth-earbuds-pro",
          sku: "NB-ELC-001",
          categoryId: catMap["electronics"],
          price: "2500.00",
          salePrice: "1899.00",
          stock: 45,
          rating: "4.8",
          reviewCount: 124,
          isFeatured: true,
          isNewArrival: true,
          isFlashSale: true,
          description: "Active Noise Cancellation, 32-hour battery life, low-latency gaming mode, and IPX5 water resistance.",
          img: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&q=80",
        },
        {
          name: "AMOLED Smart Watch Series X",
          slug: "amoled-smart-watch-series-x",
          sku: "NB-ELC-002",
          categoryId: catMap["electronics"],
          price: "4800.00",
          salePrice: "3699.00",
          stock: 28,
          rating: "4.6",
          reviewCount: 89,
          isFeatured: true,
          isNewArrival: true,
          isFlashSale: true,
          description: "1.85-inch Always-On AMOLED display, Bluetooth calling, SpO2 & heart-rate monitoring, 7-day battery.",
          img: "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=600&q=80",
        },
        {
          name: "Fast Charging Power Bank 20000mAh 22.5W",
          slug: "fast-charging-power-bank-20000mah",
          sku: "NB-ELC-003",
          categoryId: catMap["electronics"],
          price: "2200.00",
          salePrice: "1650.00",
          stock: 60,
          rating: "4.7",
          reviewCount: 203,
          isFeatured: true,
          isNewArrival: false,
          isFlashSale: true,
          description: "PD 22.5W super-fast charging with dual USB-A and Type-C ports plus LED battery display.",
          img: "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=600&q=80",
        },
        {
          name: "65W GaN Fast Charger Adapter",
          slug: "65w-gan-fast-charger-adapter",
          sku: "NB-ELC-004",
          categoryId: catMap["electronics"],
          price: "1950.00",
          salePrice: "1499.00",
          stock: 35,
          rating: "4.9",
          reviewCount: 64,
          isFeatured: true,
          isNewArrival: true,
          isFlashSale: true,
          description: "Compact GaN charger suitable for laptops, tablets, iPhones, and Android flagship phones.",
          img: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&q=80",
        },
        {
          name: "Premium Men's Cotton Panjabi",
          slug: "premium-mens-cotton-panjabi",
          sku: "NB-FSH-001",
          categoryId: catMap["fashion"],
          price: "1850.00",
          salePrice: "1490.00",
          stock: 70,
          rating: "4.5",
          reviewCount: 52,
          isFeatured: true,
          isNewArrival: true,
          isFlashSale: false,
          description: "100% breathable combed cotton Panjabi with subtle embroidery.",
          img: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&q=80",
        },
        {
          name: "Minimalist Ambient Desk Lamp",
          slug: "minimalist-ambient-desk-lamp",
          sku: "NB-HML-001",
          categoryId: catMap["home-living"],
          price: "1600.00",
          salePrice: "1250.00",
          stock: 8,
          rating: "4.7",
          reviewCount: 41,
          isFeatured: true,
          isNewArrival: true,
          isFlashSale: false,
          description: "Warm & cool dimmable LED desk lamp with touch control for study and bedroom decor.",
          img: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&q=80",
        },
      ];

      for (const item of sampleProducts) {
        const { img, ...prodValues } = item;
        const [inserted] = await db.insert(products).values(prodValues).returning();
        await db.insert(productImages).values({
          productId: inserted.id,
          imageUrl: img,
          isMain: true,
          sortOrder: 0,
        });
      }
      console.log("✅ Sample categories & products seeded");
    }

    // 4. Default Couriers
    const existingCouriers = await db.select().from(couriers).limit(1);
    if (existingCouriers.length === 0) {
      await db.insert(couriers).values([
        { name: "Steadfast Courier", trackingUrl: "https://steadfast.com.bd/t/", isActive: true },
        { name: "Pathao Courier", trackingUrl: "https://merchant.pathao.com/tracking?consignment_id=", isActive: true },
        { name: "RedX", trackingUrl: "https://redx.com.bd/track-global-parcel/?trackingId=", isActive: true },
        { name: "Sundarban Courier", trackingUrl: "https://scs.sundarbancourierltd.com/", isActive: true },
      ]);
      console.log("✅ Couriers seeded");
    }

    // 5. Default Coupons
    const existingCoupons = await db.select().from(coupons).limit(1);
    if (existingCoupons.length === 0) {
      await db.insert(coupons).values([
        {
          code: "WELCOME10",
          type: "percentage",
          value: "10",
          minOrderAmount: "500",
          maxDiscountAmount: "300",
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          isActive: true,
        },
        {
          code: "FIRSTFREE",
          type: "flat",
          value: "60",
          minOrderAmount: "300",
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          isActive: true,
        },
      ]);
      console.log("✅ Coupons seeded (WELCOME10, FIRSTFREE)");
    }

    console.log("🎉 Seed completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }
}

seed();
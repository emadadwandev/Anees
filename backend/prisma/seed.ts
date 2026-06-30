import { PrismaClient, Role, DeviceStatus, DeviceType, RelationshipType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Anees database...\n');

  // ─── 1. Elderly User (Care Receiver) ──────────────────────────────────────
  // The monitored patient — an elderly person living at home with an mmWave
  // device installed in their bedroom.
  const elderly = await prisma.user.upsert({
    where: { email: 'elderly.hassan@anees.dev' },
    update: {},
    create: {
      email: 'elderly.hassan@anees.dev',
      passwordHash: await bcrypt.hash('elderly123', 10),
      role: Role.care_receiver,
      firstName: 'Hassan',
      lastName: 'Al-Rashid',
      phone: '+966501112233',
      language: 'ar',
    },
  });

  // ─── 2. Caregiver — Family Member (Primary) ───────────────────────────────
  // Son of the elderly patient. Receives fall / vital alerts on his phone and
  // can initiate the voice intercom from the mobile app.
  const familyCaregiver = await prisma.user.upsert({
    where: { email: 'family.caregiver@anees.dev' },
    update: {},
    create: {
      email: 'family.caregiver@anees.dev',
      passwordHash: await bcrypt.hash('caregiver123', 10),
      role: Role.caregiver,
      firstName: 'Omar',
      lastName: 'Al-Rashid',
      phone: '+966502223344',
      language: 'ar',
    },
  });

  // ─── 3. Dashboard User (Admin) ────────────────────────────────────────────
  // Clinical operations staff who monitors the full roster, manages device
  // assignments, and reviews audit logs through the web dashboard.
  const dashboardAdmin = await prisma.user.upsert({
    where: { email: 'dashboard@anees.dev' },
    update: {},
    create: {
      email: 'dashboard@anees.dev',
      passwordHash: await bcrypt.hash('dashboard123', 10),
      role: Role.admin,
      firstName: 'Layla',
      lastName: 'Nour',
      phone: '+966503334455',
      language: 'en',
    },
  });

  // ─── Extra: Second elderly patient for roster variety ─────────────────────
  const elderly2 = await prisma.user.upsert({
    where: { email: 'elderly.fatima@anees.dev' },
    update: {},
    create: {
      email: 'elderly.fatima@anees.dev',
      passwordHash: await bcrypt.hash('elderly123', 10),
      role: Role.care_receiver,
      firstName: 'Fatima',
      lastName: 'Al-Zahra',
      phone: '+966504445566',
      language: 'ar',
    },
  });

  // ─── Extra: Secondary caregiver (professional nurse) ──────────────────────
  const nurseCaregiver = await prisma.user.upsert({
    where: { email: 'nurse.sara@anees.dev' },
    update: {},
    create: {
      email: 'nurse.sara@anees.dev',
      passwordHash: await bcrypt.hash('caregiver123', 10),
      role: Role.caregiver,
      firstName: 'Sara',
      lastName: 'Mahmoud',
      phone: '+966505556677',
      language: 'en',
    },
  });

  // ─── Devices ──────────────────────────────────────────────────────────────
  // ST-FDVT3-WT: ceiling fall alarm radar for Hassan
  const device1 = await prisma.device.upsert({
    where: { serial: 'AWR6843-SN001' },
    update: { status: DeviceStatus.online, lastHeartbeat: new Date(), deviceType: DeviceType.fall_sensor },
    create: {
      userId: elderly.id,
      serial: 'AWR6843-SN001',
      firmwareVersion: '2.4.1',
      roomLabel: 'Bedroom — Hassan',
      status: DeviceStatus.online,
      lastHeartbeat: new Date(),
      signalQuality: 0.87,
      deviceType: DeviceType.fall_sensor,
    },
  });

  // ST-BD60S1-WT: bedside sleep monitoring radar for Fatima
  const device2 = await prisma.device.upsert({
    where: { serial: 'AWR6843-SN002' },
    update: { status: DeviceStatus.online, lastHeartbeat: new Date(), deviceType: DeviceType.sleep_sensor },
    create: {
      userId: elderly2.id,
      serial: 'AWR6843-SN002',
      firmwareVersion: '2.4.1',
      roomLabel: 'Bedroom — Fatima',
      status: DeviceStatus.online,
      lastHeartbeat: new Date(),
      signalQuality: 0.91,
      deviceType: DeviceType.sleep_sensor,
    },
  });

  // ─── Caregiver Links ──────────────────────────────────────────────────────
  // Omar (family) is primary caregiver for his father Hassan
  await prisma.caregiverLink.upsert({
    where: {
      caregiverId_patientId: {
        caregiverId: familyCaregiver.id,
        patientId: elderly.id,
      },
    },
    update: {},
    create: {
      caregiverId: familyCaregiver.id,
      patientId: elderly.id,
      relationshipType: RelationshipType.primary,
      isPrimary: true,
    },
  });

  // Sara (nurse) is secondary caregiver for Hassan
  await prisma.caregiverLink.upsert({
    where: {
      caregiverId_patientId: {
        caregiverId: nurseCaregiver.id,
        patientId: elderly.id,
      },
    },
    update: {},
    create: {
      caregiverId: nurseCaregiver.id,
      patientId: elderly.id,
      relationshipType: RelationshipType.secondary,
      isPrimary: false,
    },
  });

  // Sara (nurse) is primary caregiver for Fatima
  await prisma.caregiverLink.upsert({
    where: {
      caregiverId_patientId: {
        caregiverId: nurseCaregiver.id,
        patientId: elderly2.id,
      },
    },
    update: {},
    create: {
      caregiverId: nurseCaregiver.id,
      patientId: elderly2.id,
      relationshipType: RelationshipType.primary,
      isPrimary: true,
    },
  });

  // ─── Patient Thresholds (elderly-appropriate ranges) ──────────────────────
  // Elderly patients often have lower resting HR and wider acceptable ranges.
  await prisma.patientThreshold.upsert({
    where: { patientId: elderly.id },
    update: {},
    create: {
      patientId: elderly.id,
      hrMin: 48,   // lower — elderly bradycardia tolerance
      hrMax: 105,
      rrMin: 9,
      rrMax: 24,
    },
  });

  await prisma.patientThreshold.upsert({
    where: { patientId: elderly2.id },
    update: {},
    create: {
      patientId: elderly2.id,
      hrMin: 50,
      hrMax: 100,
      rrMin: 10,
      rrMax: 22,
    },
  });

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log('✅ Seed complete.\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ROLE              EMAIL                          PASSWORD');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Elderly patient   elderly.hassan@anees.dev       elderly123`);
  console.log(`  Elderly patient   elderly.fatima@anees.dev       elderly123`);
  console.log(`  Family caregiver  family.caregiver@anees.dev     caregiver123`);
  console.log(`  Nurse caregiver   nurse.sara@anees.dev           caregiver123`);
  console.log(`  Dashboard admin   dashboard@anees.dev            dashboard123`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`  Device 1: ${device1.serial}  →  ${device1.roomLabel}`);
  console.log(`  Device 2: ${device2.serial}  →  ${device2.roomLabel}`);
  console.log('');
  console.log('  Caregiver links:');
  console.log('    Omar  (family)  ──primary──►  Hassan');
  console.log('    Sara  (nurse)   ─secondary──►  Hassan');
  console.log('    Sara  (nurse)   ──primary──►  Fatima');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

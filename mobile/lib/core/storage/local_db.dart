import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

part 'local_db.g.dart';

class CachedVitals extends Table {
  TextColumn get patientId => text()();
  IntColumn get heartRateBpm => integer()();
  IntColumn get respRateBrpm => integer()();
  RealColumn get signalQuality => real()();
  DateTimeColumn get timestamp => dateTime()();

  @override
  Set<Column> get primaryKey => {patientId};
}

class CachedSleepSummary extends Table {
  TextColumn get patientId => text()();
  TextColumn get date => text()(); // YYYY-MM-DD
  TextColumn get qualityLabel => text()();
  DateTimeColumn get createdAt => dateTime()();

  @override
  Set<Column> get primaryKey => {patientId, date};
}

@DriftDatabase(tables: [CachedVitals, CachedSleepSummary])
class LocalDatabase extends _$LocalDatabase {
  LocalDatabase() : super(_openConnection());

  @override
  int get schemaVersion => 1;

  Future<void> upsertVital(String patientId, CachedVitalsCompanion entry) =>
      into(cachedVitals).insertOnConflictUpdate(entry);

  Future<CachedVital?> getLatestVital(String patientId) =>
      (select(cachedVitals)..where((t) => t.patientId.equals(patientId)))
          .getSingleOrNull();

  Future<void> upsertSleepSummary(
    String patientId,
    String date,
    String qualityLabel,
  ) =>
      into(cachedSleepSummary).insertOnConflictUpdate(
        CachedSleepSummaryCompanion(
          patientId: Value(patientId),
          date: Value(date),
          qualityLabel: Value(qualityLabel),
          createdAt: Value(DateTime.now()),
        ),
      );

  Future<CachedSleepSummaryData?> getSleepSummary(
          String patientId, String date) =>
      (select(cachedSleepSummary)
            ..where((t) =>
                t.patientId.equals(patientId) & t.date.equals(date)))
          .getSingleOrNull();
}

LazyDatabase _openConnection() {
  return LazyDatabase(() async {
    final dbFolder = await getApplicationDocumentsDirectory();
    final file = File(p.join(dbFolder.path, 'anees_local.sqlite'));
    return NativeDatabase.createInBackground(file);
  });
}

final localDbProvider = Provider<LocalDatabase>((ref) {
  final db = LocalDatabase();
  ref.onDispose(db.close);
  return db;
});

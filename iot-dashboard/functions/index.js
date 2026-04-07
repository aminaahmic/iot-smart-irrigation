const admin = require("firebase-admin");
admin.initializeApp();

const { onValueWritten } = require("firebase-functions/v2/database");
const { setGlobalOptions } = require("firebase-functions/v2");
const { logger } = require("firebase-functions");

setGlobalOptions({ region: "europe-west1", maxInstances: 10 });

exports.mirrorLatestToReadings = onValueWritten(
  "/devices/{deviceId}/state/latest",
  async (event) => {
    const deviceId = event.params.deviceId;

    // nova vrijednost iz RTDB
    const after = event.data.after.val();
    if (!after) {
      logger.info("No data (after is null) - skip", { deviceId });
      return;
    }

    // opcionalno: spriječi dupli upis ako se ništa bitno nije promijenilo
    // (npr. ako dobiješ isti tsEpochMs dva puta)
    const tsEpochMs = Number(after.tsEpochMs || 0);

    // Firestore destinacija
    const readingsCol = admin.firestore().collection("devices").doc(deviceId).collection("readings");

    // Ako ima tsEpochMs, koristimo ga kao ID dokumenta (dobra deduplikacija)
    // Inače auto-ID
    const docRef = tsEpochMs
      ? readingsCol.doc(String(tsEpochMs))
      : readingsCol.doc();

    // Složi payload (kopija svega + dodatna polja)
    const payload = {
      ...after,
      deviceId,
      tsEpochMs: tsEpochMs || null,
      tsText: after.tsText || null,

      // server timestamp za lako sortiranje u webu: orderBy("ts","desc")
      ts: admin.firestore.FieldValue.serverTimestamp(),
    };

    // merge: true da može ažurirati isti docId (kad je tsEpochMs isti)
    await docRef.set(payload, { merge: true });

    logger.info("Mirrored RTDB latest -> Firestore reading", {
      deviceId,
      docId: docRef.id,
      hasTsEpochMs: !!tsEpochMs,
    });
  }
);
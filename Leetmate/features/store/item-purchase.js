(function () {
  "use strict";

  function hasFirebase() {
    return typeof firebase !== "undefined" && firebase.firestore && firebase.auth;
  }

  function getCatalogItem(category, itemId) {
    if (!window.LeetmateStoreCatalog) return null;
    return window.LeetmateStoreCatalog.getStoreItemById(category, itemId);
  }

  function getInventoryCategory(category) {
    const categoryMap = {
      accessory: "Accessory",
      food: "Food",
      special: "Special",
    };

    return categoryMap[category] || category;
  }

  function getPetDocData(item) {
    const now = firebase.firestore.FieldValue.serverTimestamp();

    return {
      petRef: item.petRef || item.id,
      customName: `Cubic ${item.name}`,
      age: 0,
      stats: item.stats || null,
      stage: "Egg",
      ableToBattle: false,
      createdTimestamp: now,
      adjustedDays: 0,
    };
  }

  async function purchaseInventoryItem(db, uid, item) {
    const userRef = db.collection("users").doc(uid);
    const inventoryRef = userRef.collection("inventory").doc(item.id);

    return db.runTransaction(async (tx) => {
      const [userSnap, inventorySnap] = await Promise.all([
        tx.get(userRef),
        tx.get(inventoryRef),
      ]);

      const currentCoins = Number(userSnap.data()?.coins ?? 0);
      if (currentCoins < item.price) {
        throw new Error("Not enough coins");
      }

      if (item.category === "accessory" && inventorySnap.exists) {
        throw new Error("Accessory already owned");
      }

      const currentQuantity = Number(inventorySnap.data()?.quantity ?? 0);
      const nextQuantity = item.category === "accessory" ? 1 : currentQuantity + 1;

      tx.set(
        inventoryRef,
        {
          category: getInventoryCategory(item.category),
          quantity: nextQuantity,
          cost: item.price,
          recoveryAmount: item.recoveryAmount ?? null,
          purchasedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      tx.set(
        userRef,
        {
          coins: currentCoins - item.price,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return {
        itemId: item.id,
        category: item.category,
        coins: currentCoins - item.price,
      };
    });
  }

  async function purchasePetItem(db, uid, item) {
    const userRef = db.collection("users").doc(uid);
    const petsRef = userRef.collection("pets");
    const newPetRef = petsRef.doc();
    const [userSnap, petsSnap] = await Promise.all([
      userRef.get(),
      petsRef.where("petRef", "==", item.petRef || item.id).limit(1).get(),
    ]);

    const currentCoins = Number(userSnap.data()?.coins ?? 0);
    if (currentCoins < item.price) {
      throw new Error("Not enough coins");
    }

    if (!petsSnap.empty) {
      throw new Error("Pet already owned");
    }

    const batch = db.batch();
    batch.set(newPetRef, getPetDocData(item));
    batch.set(
      userRef,
      {
        coins: currentCoins - item.price,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await batch.commit();

    return {
      itemId: item.id,
      category: item.category,
      coins: currentCoins - item.price,
      petId: newPetRef.id,
    };
  }

  async function purchaseStoreItem({ db, uid, category, itemId }) {
    if (!hasFirebase()) {
      throw new Error("Firebase is not available");
    }

    if (!db || !uid) {
      throw new Error("Missing purchase context");
    }

    const item = getCatalogItem(category, itemId);
    if (!item) {
      throw new Error("Store item not found");
    }

    if (category === "pets") {
      return purchasePetItem(db, uid, item);
    }

    return purchaseInventoryItem(db, uid, item);
  }

  window.LeetmateStorePurchases = {
    purchaseStoreItem,
  };
})();

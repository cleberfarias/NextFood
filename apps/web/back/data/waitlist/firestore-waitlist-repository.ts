import { Timestamp } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/back/lib/firebase-admin";
import type { WaitlistRepository, WaitlistSignup } from "@/back/domain/waitlist/waitlist";

const COLLECTION = "platform";
const DOC = "waitlistSignups";

/**
 * Admin SDK bypasses Firestore Security Rules entirely, so this write path
 * needs no firestore.rules change: /platform/{docId} already denies all
 * client writes (see firestore.rules), which is exactly right here -- only
 * this server-side adapter ever writes to it.
 */
export class FirestoreWaitlistRepository implements WaitlistRepository {
  async existsByEmail(email: string): Promise<boolean> {
    const snapshot = await getAdminFirestore()
      .collection(COLLECTION)
      .doc(DOC)
      .collection("entries")
      .where("email", "==", email)
      .limit(1)
      .get();

    return !snapshot.empty;
  }

  async add(signup: WaitlistSignup): Promise<void> {
    await getAdminFirestore()
      .collection(COLLECTION)
      .doc(DOC)
      .collection("entries")
      .add({
        email: signup.email,
        businessName: signup.businessName,
        createdAt: Timestamp.fromDate(signup.createdAt),
      });
  }
}

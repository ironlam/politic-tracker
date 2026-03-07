import Mailjet from "node-mailjet";

const mailjet = new Mailjet({
  apiKey: process.env.MAILJET_API_KEY!,
  apiSecret: process.env.MAILJET_SECRET_KEY!,
});

/**
 * Add a contact to the newsletter list with double opt-in.
 */
export async function subscribeToNewsletter(email: string): Promise<{ success: boolean }> {
  const listId = Number(process.env.MAILJET_LIST_ID);

  // Create or retrieve contact
  const contactRes = await mailjet.post("contact").request({ Email: email });
  const contactData = (contactRes.body as { Data: { ID: number }[] }).Data[0];
  if (!contactData) {
    throw new Error("Mailjet: failed to create or retrieve contact");
  }
  const contactId = contactData.ID;

  // Add to list (addnoforce = won't re-add if already subscribed)
  await mailjet
    .post("contact")
    .id(contactId)
    .action("managecontactslists")
    .request({
      ContactsLists: [
        {
          ListID: listId,
          Action: "addnoforce",
        },
      ],
    });

  return { success: true };
}

/**
 * Send the newsletter to the entire contact list via Campaign Draft API.
 *
 * Flow: create draft → set content → send.
 * The Campaign API handles list delivery, unsubscribe tokens ([[UNSUB_LINK_EN]]),
 * and tracking automatically.
 */
export async function sendNewsletter({
  subject,
  htmlContent,
  textContent,
}: {
  subject: string;
  htmlContent: string;
  textContent: string;
}): Promise<{ recipientCount: number }> {
  const listId = Number(process.env.MAILJET_LIST_ID);

  // Check subscriber count first
  const listRes = await mailjet.get("contactslist").id(listId).request();
  const listData = (listRes.body as { Data: { SubscriberCount: number }[] }).Data[0];
  if (!listData) {
    throw new Error("Mailjet: contact list not found");
  }
  const subscriberCount = listData.SubscriberCount;

  if (subscriberCount === 0) {
    return { recipientCount: 0 };
  }

  // 1. Create campaign draft targeting the contact list
  const draftRes = await mailjet.post("campaigndraft").request({
    Locale: "fr_FR",
    Sender: "Poligraph",
    SenderName: "Poligraph",
    SenderEmail: "newsletter@poligraph.fr",
    Subject: subject,
    ContactsListID: listId,
  });
  const draftData = (draftRes.body as { Data: { ID: number }[] }).Data[0];
  if (!draftData) {
    throw new Error("Mailjet: failed to create campaign draft");
  }
  const draftId = draftData.ID;

  // 2. Set email content (HTML + plain text)
  await mailjet.post("campaigndraft").id(draftId).action("detailcontent").request({
    "Html-part": htmlContent,
    "Text-part": textContent,
  });

  // 3. Send the campaign
  await mailjet.post("campaigndraft").id(draftId).action("send").request({});

  return { recipientCount: subscriberCount };
}

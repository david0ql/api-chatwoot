import { Express } from "express";
import { ChatwootAPI } from "./chatwootAPI";
import { Contact, GroupChat, GroupParticipant, MessageContent, MessageMedia } from "whatsapp-web.js";

export default class ExpressRoutes {
    public static configure(express: Express, chatwootAPIMap: any) {
        express.get("/", async (req, res) => {
            res.status(200).json({
                status: "OK",
                req: req.ip,
            });
        });

        express.post("/chatwootMessage", async (req, res) => {
            try {
                const chatwootMessage = req.body;
                console.log(chatwootMessage.inbox.id, "chatwootMessage.inbox.id");
                const chatwootAPI: ChatwootAPI = chatwootAPIMap[chatwootMessage.inbox.id];

                if (chatwootAPI == null) {
                    res.status(400).json({
                        result: "API Client not found for this inbox. Verify Chatwoot Whatsapp Web service configuration.",
                    });

                    return;
                }

                const whatsappWebClientState = await chatwootAPI.whatsapp.client.getState();

                if (
                    whatsappWebClientState === "CONNECTED" &&
                    chatwootMessage.inbox.id == chatwootAPI.config.whatsappWebChatwootInboxId &&
                    chatwootMessage.message_type == "outgoing" &&
                    !chatwootMessage.private
                ) {
                    const chatwootContact = await chatwootAPI.getChatwootContactById(
                        chatwootMessage.conversation.contact_inbox.contact_id
                    );
                    const messages = await chatwootAPI.getChatwootConversationMessages(chatwootMessage.conversation.id);
                    const messageData = messages.find((message: any) => {
                        return message.id === chatwootMessage.id;
                    });

                    const to = `${chatwootContact.identifier}`;
                    let formattedMessage: string | undefined = chatwootMessage.content;
                    let messageContent: MessageContent | undefined;

                    const chatwootMentions: RegExpMatchArray | null =
                        formattedMessage == null ? null : formattedMessage.match(/@("[^@"']+"|'[^@"']+'|[^@\s"']+)/g);
                    const options: any = {};

                    if (formattedMessage != null && chatwootMentions != null) {
                        const whatsappMentions: Array<Contact> = [];
                        const groupChat: GroupChat = (await chatwootAPI.whatsapp.client.getChatById(to)) as GroupChat;
                        const groupParticipants: Array<GroupParticipant> = groupChat.participants;
                        for (const mention of chatwootMentions) {
                            for (const participant of groupParticipants) {
                                const mentionIdentifier = mention
                                    .substring(1)
                                    .replaceAll("+", "")
                                    .replaceAll("\"", "")
                                    .replaceAll("'", "")
                                    .toLowerCase();
                                const participantIdentifier = `${participant.id.user}@${participant.id.server}`;
                                const contact: Contact = await chatwootAPI.whatsapp.client.getContactById(
                                    participantIdentifier
                                );
                                if (
                                    (contact.name != null && contact.name.toLowerCase().includes(mentionIdentifier)) ||
                                    (contact.pushname != null && contact.pushname.toLowerCase().includes(mentionIdentifier)) ||
                                    contact.number.includes(mentionIdentifier)
                                ) {
                                    whatsappMentions.push(contact);
                                    formattedMessage = formattedMessage.replace(mention, `@${participant.id.user}`);
                                    break;
                                }
                            }
                        }
                        options.mentions = whatsappMentions;
                    }

                    if (chatwootAPI.config.prefixAgentNameOnMessages) {
                        let senderName = chatwootMessage.sender?.name;
                        if (chatwootMessage.conversation.messages != null && chatwootMessage.conversation.messages.length > 0) {
                            const sender = chatwootMessage.conversation.messages[0].sender;
                            senderName = sender.available_name ?? sender.name;
                        }

                        formattedMessage = `${senderName}: ${formattedMessage ?? ""}`;
                    }

                    if (messageData.attachments != null && messageData.attachments.length > 0) {
                        console.log("is media");
                        const media = await MessageMedia.fromUrl(messageData.attachments[0].data_url);
                        if (formattedMessage != null) {
                            options.caption = formattedMessage;
                        }

                        console.log(messageData.attachments[0].data_url);

                        console.log({ media, options });

                        messageContent = media;
                    } else {
                        messageContent = formattedMessage;
                    }

                    if (messageContent != null) {
                        console.log({ to, messageContent, options });
                        console.log("sending message");
                        chatwootAPI.whatsapp.client.sendMessage(to, messageContent, options);
                        console.log("message sent");
                    }
                }

                console.log("message_sent_succesfully");
                res.status(200).json({ result: "message_sent_succesfully" });
            } catch (e) {
                console.log(e);
                res.status(400).json({ result: "exception_error" });
            }
        });
    }
}

/**
 * OpenAPI Schema Definitions
 * Reusable schemas for API documentation
 *
 * @openapi
 * components:
 *   schemas:
 *     Pagination:
 *       type: object
 *       properties:
 *         page:
 *           type: integer
 *           example: 1
 *         limit:
 *           type: integer
 *           example: 20
 *         total:
 *           type: integer
 *           example: 150
 *         totalPages:
 *           type: integer
 *           example: 8
 *
 *     PartySummary:
 *       type: object
 *       properties:
 *         shortName:
 *           type: string
 *           example: "LR"
 *         name:
 *           type: string
 *           example: "Les Républicains"
 *         color:
 *           type: string
 *           nullable: true
 *           example: "#0066CC"
 *
 *     PoliticianSummary:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         slug:
 *           type: string
 *           example: "jean-dupont"
 *         fullName:
 *           type: string
 *           example: "Jean Dupont"
 *         photoUrl:
 *           type: string
 *           nullable: true
 *         currentParty:
 *           $ref: '#/components/schemas/PartySummary'
 *
 *     Source:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         url:
 *           type: string
 *           format: uri
 *         title:
 *           type: string
 *         publisher:
 *           type: string
 *           nullable: true
 *         publishedAt:
 *           type: string
 *           format: date
 *           nullable: true
 *
 *     Affair:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         slug:
 *           type: string
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         status:
 *           type: string
 *           enum: [ENQUETE_PRELIMINAIRE, MISE_EN_EXAMEN, PROCES_EN_COURS, CONDAMNATION_PREMIERE_INSTANCE, CONDAMNATION_DEFINITIVE, APPEL_EN_COURS, RELAXE, NON_LIEU, PRESCRIPTION]
 *         category:
 *           type: string
 *           enum: [CORRUPTION, FRAUDE_FISCALE, BLANCHIMENT, TRAFIC_INFLUENCE, PRISE_ILLEGALE_INTERET, DETOURNEMENT_FONDS, ABUS_BIENS_SOCIAUX, EMPLOI_FICTIF, FAVORITISME, RECEL, VIOLENCE, HARCELEMENT_MORAL, HARCELEMENT_SEXUEL, AGRESSION_SEXUELLE, VIOL, DIFFAMATION, INJURES, INCITATION_HAINE, AUTRE]
 *         factsDate:
 *           type: string
 *           format: date
 *           nullable: true
 *         startDate:
 *           type: string
 *           format: date
 *           nullable: true
 *         verdictDate:
 *           type: string
 *           format: date
 *           nullable: true
 *         sentence:
 *           type: string
 *           nullable: true
 *         appeal:
 *           type: boolean
 *         politician:
 *           $ref: '#/components/schemas/PoliticianSummary'
 *         partyAtTime:
 *           $ref: '#/components/schemas/PartySummary'
 *         sources:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Source'
 *
 *     Scrutin:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         externalId:
 *           type: string
 *         title:
 *           type: string
 *         votingDate:
 *           type: string
 *           format: date
 *         legislature:
 *           type: integer
 *           example: 16
 *         votesFor:
 *           type: integer
 *         votesAgainst:
 *           type: integer
 *         votesAbstain:
 *           type: integer
 *         result:
 *           type: string
 *           enum: [ADOPTED, REJECTED]
 *         sourceUrl:
 *           type: string
 *           format: uri
 *           nullable: true
 *
 *     Vote:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         position:
 *           type: string
 *           enum: [POUR, CONTRE, ABSTENTION, ABSENT]
 *         scrutin:
 *           $ref: '#/components/schemas/Scrutin'
 *
 *     VoteStats:
 *       type: object
 *       properties:
 *         total:
 *           type: integer
 *         pour:
 *           type: integer
 *         contre:
 *           type: integer
 *         abstention:
 *           type: integer
 *         absent:
 *           type: integer
 *         participationRate:
 *           type: number
 *           format: float
 *
 *     SearchResult:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         fullName:
 *           type: string
 *         slug:
 *           type: string
 *         photoUrl:
 *           type: string
 *           nullable: true
 *         party:
 *           type: string
 *           nullable: true
 *         partyColor:
 *           type: string
 *           nullable: true
 *         mandate:
 *           type: string
 *           nullable: true
 *
 *     Error:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           example: "Erreur serveur"
 */

export {};

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
 *     Politician:
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
 *         firstName:
 *           type: string
 *           example: "Jean"
 *         lastName:
 *           type: string
 *           example: "Dupont"
 *         civility:
 *           type: string
 *           enum: [M, MME]
 *           nullable: true
 *         birthDate:
 *           type: string
 *           format: date
 *           nullable: true
 *         deathDate:
 *           type: string
 *           format: date
 *           nullable: true
 *         birthPlace:
 *           type: string
 *           nullable: true
 *         photoUrl:
 *           type: string
 *           nullable: true
 *         currentParty:
 *           $ref: '#/components/schemas/PartySummary'
 *
 *     Mandate:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         type:
 *           type: string
 *           enum: [DEPUTE, SENATEUR, DEPUTE_EUROPEEN, PRESIDENT, PREMIER_MINISTRE, MINISTRE, SECRETAIRE_ETAT, MAIRE, PRESIDENT_REGION, PRESIDENT_DEPARTEMENT, CONSEILLER_REGIONAL, CONSEILLER_DEPARTEMENTAL, CONSEILLER_MUNICIPAL]
 *         title:
 *           type: string
 *           example: "Député de la 3ème circonscription du Rhône"
 *         institution:
 *           type: string
 *           nullable: true
 *         constituency:
 *           type: string
 *           nullable: true
 *         startDate:
 *           type: string
 *           format: date
 *         endDate:
 *           type: string
 *           format: date
 *           nullable: true
 *         isCurrent:
 *           type: boolean
 *
 *     Declaration:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         type:
 *           type: string
 *           enum: [PATRIMOINE, INTERETS]
 *         year:
 *           type: integer
 *           example: 2024
 *         url:
 *           type: string
 *           format: uri
 *           nullable: true
 *
 *     PoliticianDetails:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         slug:
 *           type: string
 *         fullName:
 *           type: string
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         civility:
 *           type: string
 *           enum: [M, MME]
 *           nullable: true
 *         birthDate:
 *           type: string
 *           format: date
 *           nullable: true
 *         deathDate:
 *           type: string
 *           format: date
 *           nullable: true
 *         birthPlace:
 *           type: string
 *           nullable: true
 *         photoUrl:
 *           type: string
 *           nullable: true
 *         currentParty:
 *           $ref: '#/components/schemas/PartySummary'
 *         mandates:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Mandate'
 *         declarations:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Declaration'
 *         affairsCount:
 *           type: integer
 *           description: Nombre d'affaires judiciaires
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
 *           enum: [POUR, CONTRE, ABSTENTION, NON_VOTANT, ABSENT]
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
 *         nonVotant:
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

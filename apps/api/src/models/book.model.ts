import { Schema, model, type InferSchemaType } from 'mongoose';

const bookSchema = new Schema(
  {
    bookId: { type: Number, required: true, min: 0 },
    canonicalId: { type: String, required: true },
    title: { type: String, required: true },
    author: { type: String, default: null },
    authorKey: { type: String, default: null },
    genres: { type: [String], default: [] },
    primaryGenre: { type: String, required: true },
    year: { type: Number, default: null },
    pages: { type: Number, default: null },
    description: { type: String, default: '' },
    image: { type: String, default: null },
    isbn13: { type: String, default: null },
    series: {
      type: new Schema({ id: String, name: String, pos: Number }, { _id: false }),
      default: null,
    },
    avgRating: { type: Number, default: null },
    ratingsCount: { type: Number, default: null },
    tagline: { type: String, default: null },
    cover: {
      type: new Schema(
        { c1: String, c2: String, ink: String, accent: String, motif: String, layout: String, font: String },
        { _id: false },
      ),
      default: null,
    },
    source: { type: String, enum: ['model', 'fixture'], required: true },
  },
  { timestamps: true },
);

bookSchema.index({ bookId: 1 }, { unique: true });
bookSchema.index({ primaryGenre: 1, title: 1 });
bookSchema.index({ genres: 1 });
bookSchema.index({ authorKey: 1 });
bookSchema.index({ title: 'text', author: 'text' }, { weights: { title: 3, author: 2 } });

export type Book = InferSchemaType<typeof bookSchema>;
export const BookModel = model('Book', bookSchema);

/** Records which catalogue the books came from, so a reseed never silently remaps book ids. */
const catalogMetaSchema = new Schema(
  {
    key: { type: String, required: true },
    source: { type: String, enum: ['model', 'fixture'], required: true },
    modelVersion: { type: String, default: null },
    /** The service's data version: book ids are stable within one, renumbered across them. */
    dataVersion: { type: String, default: null },
    count: { type: Number, required: true },
    seededAt: { type: Date, required: true },
  },
  { timestamps: false },
);
catalogMetaSchema.index({ key: 1 }, { unique: true });
export const CatalogMetaModel = model('CatalogMeta', catalogMetaSchema);

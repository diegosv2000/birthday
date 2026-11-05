export type GuestState = "Ready" | "Banned";

export interface GuestDBO {
  /** Documento nacional de identidad: exactamente 8 dígitos. Índice único. */
  dni: string;

  /** Nombre completo tal como el invitado lo escribió. */
  fullName: string;

  /** Siempre "Ready" al crear; "Banned" solo se asigna manualmente desde la base. */
  state: GuestState;

  /** Momento de la confirmación (server-side). */
  createdAt: Date;

  /** Reservado; las re-confirmaciones idempotentes no mutan el documento. */
  updatedAt?: Date;
}

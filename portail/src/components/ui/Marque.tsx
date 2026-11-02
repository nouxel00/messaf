/** Logo textuel MESSAF-BF : emblème bicolore à l'étoile d'or, sans reprise d'armoiries officielles. */
export function Embleme({ taille = 34 }: { taille?: number }) {
  return (
    <svg className="marque-embleme" width={taille} height={taille} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="16" fill="#c8102e" />
      <rect y="16" width="32" height="16" fill="#00843d" />
      <path d="M16 9.5l1.9 4.6 4.9.4-3.7 3.2 1.1 4.8L16 20l-4.2 2.5 1.1-4.8-3.7-3.2 4.9-.4z" fill="#fcd116" />
    </svg>
  );
}

export function Marque({ sousTitre = 'Portail RH' }: { sousTitre?: string }) {
  return (
    <span className="marque">
      <Embleme />
      <span>
        <span className="marque-nom">
          MESSAF<span>-BF</span>
        </span>
        <span className="marque-sous-titre" style={{ display: 'block' }}>
          {sousTitre}
        </span>
      </span>
    </span>
  );
}

export function Etoile({ taille = 180 }: { taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" className="appel-action-etoile" aria-hidden>
      <path
        fill="currentColor"
        d="M12 2l2.9 7.1 7.6.6-5.8 5 1.8 7.4L12 18.1 5.5 22.1l1.8-7.4-5.8-5 7.6-.6z"
      />
    </svg>
  );
}

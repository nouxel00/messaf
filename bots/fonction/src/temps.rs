//! Dates lisibles en français, sans dépendance : l'heure affichée est l'heure de Ouagadougou (UTC).

const MOIS: [&str; 12] = [
    "janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

/// Jour civil (année, mois, jour) d'un nombre de jours depuis le 1er janvier 1970.
fn civil(jours: i64) -> (i64, u32, u32) {
    // Algorithme de Howard Hinnant (« days_from_civil » inversé)
    let z = jours + 719_468;
    let ere = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let jour = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let mois = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    let annee = yoe + ere * 400 + i64::from(mois <= 2);
    (annee, mois, jour)
}

/// « 3 nov. 2026 à 10:02 » pour un horodatage Matrix en millisecondes.
pub fn date_heure(ms: u64) -> String {
    let secondes = (ms / 1000) as i64;
    let (a, m, j) = civil(secondes.div_euclid(86_400));
    let s = secondes.rem_euclid(86_400);
    format!(
        "{j} {} {a} à {:02}:{:02}",
        MOIS[(m - 1) as usize],
        s / 3600,
        (s % 3600) / 60
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dates() {
        assert_eq!(date_heure(0), "1 janv. 1970 à 00:00");
        // 3 novembre 2026, 10:02 UTC
        assert_eq!(date_heure(1_793_700_120_000), "3 nov. 2026 à 10:02");
        // 29 février 2024, 23:59 UTC
        assert_eq!(date_heure(1_709_251_140_000), "29 févr. 2024 à 23:59");
    }
}

-- Exécuté une seule fois, à la création du volume PostgreSQL.
-- Synapse exige une base en collation "C".
CREATE DATABASE synapse
  ENCODING 'UTF8'
  LC_COLLATE 'C'
  LC_CTYPE 'C'
  TEMPLATE template0
  OWNER messaf;

CREATE DATABASE keycloak OWNER messaf;

-- MAS (Matrix Authentication Service) : sessions des applications Matrix
CREATE DATABASE mas OWNER messaf;

-- API d'administration : organigramme, postes, affectations, journal d'audit
CREATE DATABASE api OWNER messaf;

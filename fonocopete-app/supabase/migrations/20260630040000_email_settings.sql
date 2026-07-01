update public.site_settings
set value =
  value
  || jsonb_build_object(
    'email',
    coalesce(
      value->'email',
      '{
        "transactionalEnabled": false,
        "fromName": "Fonocopete Concepcion",
        "fromEmail": "contacto@fonocopeteconcepcion.cl",
        "ownerEmail": "contacto@fonocopeteconcepcion.cl",
        "replyToEmail": "contacto@fonocopeteconcepcion.cl",
        "smtpHost": "",
        "smtpPort": "587",
        "smtpUser": "",
        "credentialsConfigured": false
      }'::jsonb
    )
  )
where key = 'main';

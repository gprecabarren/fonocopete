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
        "fromEmail": "fonocopetepenquista@gmail.com",
        "ownerEmail": "fonocopetepenquista@gmail.com",
        "replyToEmail": "fonocopetepenquista@gmail.com",
        "smtpHost": "",
        "smtpPort": "587",
        "smtpUser": "",
        "credentialsConfigured": false
      }'::jsonb
    )
  )
where key = 'main';

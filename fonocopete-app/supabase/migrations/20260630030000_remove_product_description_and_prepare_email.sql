alter table public.products
drop column if exists description;

update public.site_settings
set value =
  value
  || jsonb_build_object(
    'contactEmail',
    case
      when coalesce(value->>'contactEmail', '') in ('', 'fonocopeteconcepcion.maverik@gmail.com')
        then 'contacto@fonocopeteconcepcion.cl'
      else value->>'contactEmail'
    end,
    'newsletter',
    coalesce(
      value->'newsletter',
      '{
        "enabled": false,
        "provider": "mailchimp",
        "audienceId": "",
        "formUrl": "",
        "defaultTags": "promociones, clientes web"
      }'::jsonb
    )
  )
where key = 'main';

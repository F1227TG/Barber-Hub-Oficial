-- Closing at midnight does not create a zero-length interval on the next day.
do $$
declare definition text;
begin
 definition:=pg_get_functiondef('private.sincronizar_horario_legado_dia_110(uuid,smallint)'::regprocedure);
 if position('and p.fecha > time ''00:00''' in definition)=0 then
  definition:=replace(definition,'and p.ativo and p.fecha_dia_seguinte','and p.ativo and p.fecha_dia_seguinte and p.fecha > time ''00:00''');
  execute definition;
 end if;
end $$;

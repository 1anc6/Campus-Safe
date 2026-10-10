-- Campus: Graphic Era (Deemed to be) University, Bell Road, Clement Town, Dehradun.
-- Coordinates from OpenStreetMap (ODbL). Existing location ids are kept and moved;
-- new buildings are added. Mirrors LOCATIONS in src/lib/campus.ts.

insert into campus_locations (id, name, zone, lat, lng) values
  ('gate', 'Gate 1 (Main Gate)', 'Entry', 30.26863, 77.99479),
  ('gate-2', 'Gate 2', 'Entry', 30.26872, 77.99788),
  ('lh3', 'CS-IT Block', 'Academic', 30.26895, 77.99318),
  ('science', 'B.Tech Block', 'Academic', 30.26730, 77.99525),
  ('civil', 'Civil Engineering Block', 'Academic', 30.26686, 77.99547),
  ('aryabhatt', 'Aryabhatt Computer Center', 'Academic', 30.26768, 77.99575),
  ('chanakya', 'Chanakya Block', 'Academic', 30.26749, 77.99699),
  ('vishwakarma', 'Vishwakarma Block', 'Academic', 30.26805, 77.99624),
  ('pharma', 'Pharma Block', 'Academic', 30.26939, 77.99286),
  ('library', 'Central Library', 'Academic', 30.26729, 77.99574),
  ('admin', 'Silver Jubilee Convention Center', 'Admin', 30.26930, 77.99493),
  ('hostel-a', 'Lakshmi Bai Girls Hostel', 'Residence', 30.26768, 77.99361),
  ('hostel-p', 'Priyadarshini Hostel', 'Residence', 30.26872, 77.99617),
  ('mess', 'Mess', 'Commons', 30.26762, 77.99393),
  ('cafe', 'Cafe and Gym', 'Commons', 30.26714, 77.99467),
  ('sports', 'Basketball Court', 'Recreation', 30.26702, 77.99596),
  ('badminton', 'Indoor Badminton Court', 'Recreation', 30.26688, 77.99502),
  ('medical', 'Dispensary', 'Health', 30.26854, 77.99503),
  ('parking', 'Parking', 'Entry', 30.26840, 77.99718)
on conflict (id) do update set
  name = excluded.name, zone = excluded.zone, lat = excluded.lat, lng = excluded.lng;

-- Reports filed against a campus location follow it to the new coordinates.
-- GPS-pinned reports (no location_id) keep their real coordinates.
update incidents i
set lat = l.lat, lng = l.lng
from campus_locations l
where i.location_id = l.id;

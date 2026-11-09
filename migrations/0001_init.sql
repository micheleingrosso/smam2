PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT OR IGNORE INTO app_settings(key,value) VALUES ('global_discount_percent','0.0000');

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  course TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(first_name,last_name,course)
);
CREATE INDEX IF NOT EXISTS idx_students_name ON students(last_name,first_name);
CREATE INDEX IF NOT EXISTS idx_students_course ON students(course);

CREATE TABLE IF NOT EXISTS repair_tariffs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  garment_type TEXT NOT NULL,
  repair_code INTEGER NOT NULL,
  repair_description TEXT NOT NULL,
  taxable_amount_cents INTEGER NOT NULL DEFAULT 0,
  vat_percent REAL NOT NULL DEFAULT 22,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(garment_type,repair_code)
);
CREATE INDEX IF NOT EXISTS idx_tariffs_key ON repair_tariffs(garment_type,repair_code);

CREATE TABLE IF NOT EXISTS student_work_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  tariff_id INTEGER NOT NULL,
  work_date TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity >= 0),
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE RESTRICT,
  FOREIGN KEY(tariff_id) REFERENCES repair_tariffs(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_work_student ON student_work_items(student_id);
CREATE INDEX IF NOT EXISTS idx_work_date ON student_work_items(work_date);
CREATE INDEX IF NOT EXISTS idx_work_tariff ON student_work_items(tariff_id);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_date TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Altro',
  supplier TEXT NOT NULL DEFAULT '',
  taxable_amount_cents INTEGER NOT NULL DEFAULT 0,
  vat_percent REAL NOT NULL DEFAULT 22,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);

CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  hourly_rate_cents INTEGER NOT NULL DEFAULT 900,
  notes TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_employees_name ON employees(last_name,first_name);

CREATE TABLE IF NOT EXISTS employee_hours (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  work_date TEXT NOT NULL,
  minutes INTEGER NOT NULL CHECK(minutes >= 0 AND minutes <= 1440),
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_employee_hours_employee ON employee_hours(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_hours_date ON employee_hours(work_date);

CREATE TABLE IF NOT EXISTS employee_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  payment_date TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK(amount_cents >= 0),
  method TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_employee_payments_employee ON employee_payments(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_payments_date ON employee_payments(payment_date);

INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('GIACCA DELLE UNIFORMI',1,'Accorciare maniche',540,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('GIACCA DELLE UNIFORMI',2,'Allungare le maniche applicando un’aggiunta di fodera',780,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('GIACCA DELLE UNIFORMI',3,'Fare cucitura lunga cm. 10 in qualsiasi parte di unione al lato esterno',150,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('GIACCA DELLE UNIFORMI',4,'Cambiare la fodera di una manica',590,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('GIACCA DELLE UNIFORMI',5,'Stirare l’intera giacca',350,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('GIACCA DELLE UNIFORMI',6,'Stringere le cuciture dei fianchi senza scucire le maniche sotto le ascelle',850,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('GIACCA DELLE UNIFORMI',7,'Stringere la cucitura lungo i fianchi con scucitura e ricucitura delle maniche',950,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('GIACCA DELLE UNIFORMI',8,'Aggiungere una lista di fodera alta fino a cm 5 per tutto il fondo della manica',300,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('GIACCA DELLE UNIFORMI',9,'Aggiungere una lista di fodera alta fino a cm 10 per tutto il fondo della giacca',520,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('GIACCA DELLE UNIFORMI',10,'Allargare o stringere il giro maniche',1250,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('GIACCA DELLE UNIFORMI',11,'Cucire una travetta (distintivo di categoria) sulla cucitura di una spalla',200,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('GIACCA DELLE UNIFORMI',12,'Cambiare una travetta (distintivo di categoria) sulla cucitura di una spalla',300,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('GIACCA DELLE UNIFORMI',13,'Accorciare la giacca',1300,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('PANTALONI DELLE UNIFORMI',1,'Accorciare i pantaloni, spostare il battitacco e stirare il dappiede',720,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('PANTALONI DELLE UNIFORMI',2,'Allargare i pantaloni in vita',380,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('PANTALONI DELLE UNIFORMI',3,'Allargare o stringere i pantaloni al cavallo',550,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('PANTALONI DELLE UNIFORMI',4,'Allungare i pantaloni, ricucire il battitacco e stirare il dappiede',850,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('PANTALONI DELLE UNIFORMI',5,'Ridurre l’ampiezza alla vita nella parte posteriore',350,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('PANTALONI DELLE UNIFORMI',6,'Sostituire la cerniera lampo',355,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('PANTALONI DELLE UNIFORMI',7,'Stirare i pantaloni',250,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('PANTALONI DELLE UNIFORMI',8,'Stringere i pantaloni da sotto la cintura al fondo (largo circa 22 cm)',1180,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('PANTALONI DELLE UNIFORMI',9,'Ridurre ampiezza interno coscia',650,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('SOPRABITO IMPERMEABILE',1,'Abbassare l’incollatura con relativa modifica sulle spalle',1200,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('SOPRABITO IMPERMEABILE',2,'Accorciare il soprabito',1350,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('SOPRABITO IMPERMEABILE',3,'Accorciare le maniche',850,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('SOPRABITO IMPERMEABILE',4,'Allargare il giro all’attaccatura delle maniche',1500,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('SOPRABITO IMPERMEABILE',5,'Allargare o restringere i fianchi',1350,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('SOPRABITO IMPERMEABILE',6,'Allungare le maniche con relativa aggiunta di fodera',1200,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('SOPRABITO IMPERMEABILE',7,'Cambiare una controspallina',780,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('SOPRABITO IMPERMEABILE',8,'Cambiare fodera di una tasca',780,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('SOPRABITO IMPERMEABILE',9,'Cambiare fodera di una manica',520,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('SOPRABITO IMPERMEABILE',10,'Fare una cucitura lunga cm 10 a qualsiasi parte di unione sul lato esterno',190,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('SOPRABITO IMPERMEABILE',11,'Spostare l’intera martingala',450,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('SOPRABITO IMPERMEABILE',12,'Stirare l’intero soprabito',350,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('BERRETTO',1,'Cucire il fregio',250,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('BERRETTO',2,'Cambiare il fregio',300,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('BERRETTO',3,'Cucire fascia millerighe',400,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('GONNA',1,'Accorciare la gonna e la relativa fodera',550,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('GONNA',2,'Allungare la gonna',380,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('GONNA',3,'Sostituire la cerniera lampo',400,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('GONNA',4,'Ridurre o allargare l’ampiezza alla vita compresa la fodera interna',850,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('GONNA',5,'Stringere i fianchi compresa la fodera interna',920,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('GONNA',6,'Stirare la gonna',210,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('RIPARAZIONI COMUNI A PIU'' CAPI DI CORREDO',1,'Cucire un bottone',130,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('RIPARAZIONI COMUNI A PIU'' CAPI DI CORREDO',2,'Spostare un bottone',140,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('RIPARAZIONI COMUNI A PIU'' CAPI DI CORREDO',3,'Fare una cucitura a macchina lunga cm 10',40,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('RIPARAZIONI COMUNI A PIU'' CAPI DI CORREDO',4,'Cucire un distintivo di grado o specializzazione a una manica di giacca',250,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('RIPARAZIONI COMUNI A PIU'' CAPI DI CORREDO',5,'Cambiare distintivo di grado o specializzazione a una manica di giacca',300,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('RIPARAZIONI COMUNI A PIU'' CAPI DI CORREDO',6,'Cucire/Scucire il filetto al bavero della giacca degli Allievi Marescialli',350,22);
INSERT OR IGNORE INTO repair_tariffs(garment_type,repair_code,repair_description,taxable_amount_cents,vat_percent) VALUES ('RIPARAZIONI COMUNI A PIU'' CAPI DI CORREDO',7,'Cambiare il filetto al bavero della giacca di Allievi Marescialli',380,22);

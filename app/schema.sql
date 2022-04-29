-- Table containing Ethereum wallets for Discord-logged-in users
create table public.profiles (
  id uuid references auth.users not null,
  eth text not null,

  primary key (id, eth)
);

alter table public.profiles enable row level security;

create policy "Only users can view their own profile."
  on profiles for select
  using ( auth.uid() = id );

create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );

-- Basic role system for users (most notably moderators to create raffles)
create table role_types (
  id bigint generated by default as identity primary key,
  name text unique not null
);

alter table public.role_types enable row level security;

insert into role_types (name) values ('Moderator');

-- Each user can have potentially many roles
create table public.roles (
  user_id uuid references auth.users not null,
  role_id bigint references public.role_types not null,

  primary key (user_id, role_id)
);

alter table public.roles enable row level security;

create view moderators as select * from auth.users left join (
  select * from public.roles join public.role_types on public.roles.role_id = public.role_types.id
) as roles
on auth.users.id = roles.user_id
where roles.name = 'Moderator';

-- Raffles consist of name, image and description and can be managed by moderators
create table raffles (
  id bigint generated by default as identity (minvalue 0 start with 0 increment by 1) primary key,
  inserted_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text,
  image text,
  description text
);

alter table public.raffles enable row level security;

create policy "Raffles are viewable by everyone."
  on raffles for select
  using ( true );

create policy "Raffles can be inserted by moderators."
  on raffles for insert
  with check (exists(select * from moderators where user_id = auth.uid()));

create policy "Raffles can be updated by moderators."
  on raffles for update
  with check (exists(select * from moderators where user_id = auth.uid()));

-- Seed
insert into raffles (name, image, description) values
('Moonbirds', '/moonbirds.png', 'A collection of 10,000 utility-enabled PFPs that feature a richly diverse and unique pool of rarity-powered traits. What’s more, each Moonbird unlocks private club membership and additional benefits the longer you hold them.'),
('Shinsei Galverse', '/galverse.png', 'Shinsei Galverse is a collection of 8,888 Gals shooting across space and time to bring a project of peace to all cultures and people.'),
('Murakami Flowers', '/murakami.png', 'Murakami.Flowers is a work in which artist Takashi Murakami’s representative artwork, flowers, are expressed as dot art evocative of Japanese TV games created in the 1970s. Each field has 108 flower images, resulting in 11,664 flower images in total.'),
('Zarc', '/zarc.png', 'ddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'),
('Everai Heroes', '/everai.jpg', 'Everai is a brand of Heroes. Our mission is to build a long-lasting metaverse brand. Built for the people, with the people. Everai holders will be granted exclusive access to drops, experiences, and much more.'),
('ON1 Force', '/oni.png', 'The 0N1 Force are 7,777 generative side-profile characters with over 100 hand-drawn features fighting for their existence. Strength, spirit, and style are what you’ll need to survive in The Ethereal Enclave.');

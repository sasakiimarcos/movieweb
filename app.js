const express = require('express');
const sqlite3 = require('sqlite3');
const ejs = require('ejs');

const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the "views" directory
app.use(express.static('views'));

// Conectar a la base de datos SQLite
const db = new sqlite3.Database('movies.db');

// Configurar el motor de plantillas EJS
app.set('view engine', 'ejs');

// Ruta para la página de inicio
app.get('/', (req, res) => {
    res.render('index');
});

// Ruta para buscar películas
app.get('/buscar', (req, res) => {
    // options contiene las opciones de busqueda, Ej: All, Movies, Directors, Actors.
    const options = req.query.o;
    const searchTerm = req.query.q;
    let genres = req.query.g;
    // turns genres into an array if it is not
    genres = Array.isArray(genres) ? genres : [genres]
    const language = req.query.l;
    let keywords = req.query.k;
    keywords = keywords.split(", ");
    // genreType determines whether search by genres will be done with or or and
    const genreType = req.query.gi;
    // keywordType determines whether search by genres will be done with or or and
    const keywordType = req.query.ki;

    // para que el arreglo qeude vacio si no tiene nada
    if (keywords[0] === "") keywords = [];

    // *** MOVIES ***
    let sql = `SELECT distinct m.movie_id, title 
                      FROM movie as m
                      join movie_genres as mg on m.movie_id=mg.movie_id
                      join genre as g on mg.genre_id=g.genre_id
                      join movie_languages as ml on m.movie_id=ml.movie_id and ml.language_role_id=1
                      join language as l on ml.language_id=l.language_id
                      join movie_keywords as mk on m.movie_id=mk.movie_id
                      join keyword as k on mk.keyword_id=k.keyword_id
                      WHERE m.title LIKE ? and l.language_code like ?`;
    let params = [];

    // Siguente serie de ifs anidados basicamente contempla cada uno de las posibles situaciones cuando se hace una
    // busqueda de peliculas por generos y keywords. Reconozco que hay formas mas optimas para hacerlo con menos codigo
    // pero por un tema de organizacion y legibilidad se hizo asi. Para cada uno de las situaciones, hay un orden
    // particular de hacer pushes de los paramtros y partes especificas de la consulta que se deben modificar.

    // Case where genres exists
    if (genres) {
        // genres selected exclusively
        if (typeof genreType === "undefined") {
            // Case where keywords are selected
            if (keywords.length !== 0) {
                // case where keywords selection is exclusive
                if (typeof keywordType === "undefined") {

                    params.push(...genres);
                    params.push(...keywords);
                    params.push(`%${searchTerm}%`);
                    if (language === "All" ){
                        params.push(`%`)
                    } else {
                        params.push(`${language}`)
                    }

                    sql = ' with desiredGenres as (select genre_name, genre_id from genre where genre_name in (' + genres.map(() => '?').join(',') + '))'
                        + ', desiredKeys as (select keyword_name, keyword_id from keyword where keyword_name in (' + keywords.map(() => '?').join(',') + '))' + sql;
                    sql += ' and not exists (select 1 from desiredKeys dk where not exists(select 1 from movie_keywords as mk where m.movie_id=mk.movie_id and dk.keyword_id=mk.keyword_id))'
                        + ' and not exists (select 1 from desiredGenres dg where not exists(select 1 from movie_genres as mg where m.movie_id=mg.movie_id and dg.genre_id=mg.genre_id))'
                // Case where keyword selection is inclusive
                } else {

                    params.push(...genres);
                    params.push(`%${searchTerm}%`);
                    if (language === "All" ){
                        params.push(`%`)
                    } else {
                        params.push(`${language}`)
                    }
                    params.push(...keywords);

                    sql = ' with desiredGenres as (select genre_name, genre_id from genre where genre_name in (' + genres.map(() => '?').join(',') + '))' + sql;
                    sql += ' and not exists (select 1 from desiredGenres dg where not exists(select 1 from movie_genres as mg where m.movie_id=mg.movie_id and dg.genre_id=mg.genre_id))'
                        + ' and keyword_name in (' + keywords.map(() => '?').join(',') + ')'
                }
            //     case where keywords are not selected
            } else {

                params.push(...genres);
                params.push(`%${searchTerm}%`);
                if (language === "All" ){
                    params.push(`%`)
                } else {
                    params.push(`${language}`)
                }

                sql = ' with desiredGenres as (select genre_name, genre_id from genre where genre_name in (' + genres.map(() => '?').join(',') + '))' + sql;
                sql += ' and not exists (select 1 from desiredGenres dg where not exists(select 1 from movie_genres as mg where m.movie_id=mg.movie_id and dg.genre_id=mg.genre_id))'
            }
        //     genres selected inclusively
        } else {
            // Case where keywords are selected
            if (keywords.length !== 0) {
                // case where keywords selection is exclusive
                if (typeof keywordType === "undefined") {

                    params.push(...keywords);
                    params.push(`%${searchTerm}%`);
                    if (language === "All" ){
                        params.push(`%`)
                    } else {
                        params.push(`${language}`)
                    }
                    params.push(...genres);

                    sql = ' with desiredKeys as (select keyword_name, keyword_id from keyword where keyword_name in (' + keywords.map(() => '?').join(',') + '))' + sql;
                    sql += ' and not exists (select 1 from desiredKeys dk where not exists(select 1 from movie_keywords as mk where m.movie_id=mk.movie_id and dk.keyword_id=mk.keyword_id))'
                        + ' and genre_name in (' + genres.map(() => '?').join(',') + ')'
                    // Case where keyword selection is inclusive
                } else {
                    params.push(`%${searchTerm}%`);
                    if (language === "All" ){
                        params.push(`%`)
                    } else {
                        params.push(`${language}`)
                    }
                    params.push(...keywords);
                    params.push(...genres);

                    sql += ' and keyword_name in (' + keywords.map(() => '?').join(',') + ')'
                        + ' and genre_name in (' + genres.map(() => '?').join(',') + ')'
                }
                //     case where keywords are not selected
            } else {

                params.push(`%${searchTerm}%`);
                if (language === "All" ){
                    params.push(`%`)
                } else {
                    params.push(`${language}`)
                }
                params.push(...genres);
                sql += ' and genre_name in (' + genres.map(() => '?').join(',') + ')'
            }

        }
    //     Case where there are no genres selected
    } else {
        // Case where keywords are selected
        if (keywords.length !== 0) {
            // case where keywords selection is exclusive
            if (typeof keywordType === "undefined") {
                // pushes search term and language after pushing keywords
                params.push(...keywords);
                params.push(`%${searchTerm}%`);
                if (language === "All" ){
                    params.push(`%`)
                } else {
                    params.push(`${language}`)
                }

                sql = ' with desiredKeys as (select keyword_name, keyword_id from keyword where keyword_name in (' + keywords.map(() => '?').join(',') + '))' + sql;
                sql += ' and not exists (select 1 from desiredKeys dk where not exists(select 1 from movie_keywords as mk where m.movie_id=mk.movie_id and dk.keyword_id=mk.keyword_id))'
                // Case where keyword selection is inclusive
            } else {
                // pushes search term and language before pushing keywords
                params.push(`%${searchTerm}%`);
                if (language === "All" ){
                    params.push(`%`)
                } else {
                    params.push(`${language}`)
                }
                params.push(...keywords);
                sql += ' and keyword_name in (' + keywords.map(() => '?').join(',')
            }
        }
    }

    // La siguiente seroie de db.all() anidados se hace para poder pasar movies, actors y directos a la vez por un
    // mismo res.render().
    db.all(
        sql,
        params,
        (err, movies) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error en la búsqueda.');
            } else {
                sql = 'select distinct p.person_id, person_name from movie_cast as mc join person as p on mc.person_id=p.person_id where person_name like ?'
                params = [`%${searchTerm}%`];
                db.all(
                    sql,
                    params,
                    (err, actors) => {
                        if (err) {
                            console.error(err);
                            res.status(500).send('Error en la búsqueda.');
                        } else {
                            sql = 'select distinct p.person_id, person_name from movie_crew as mc join person as p on mc.person_id=p.person_id where job=\'Director\' and person_name like ?'
                            params = [`%${searchTerm}%`];
                            db.all(
                                sql,
                                params,
                                (err, directors) => {
                                    if (err) {
                                        console.error(err);
                                        res.status(500).send('Error en la búsqueda.');
                                    } else {
                                        if (options === 'Movies') {
                                            res.render('resultado', { movies });
                                        } else if (options === 'Actors') {
                                            res.render('resultado', { actors });
                                        } else if  (options === 'Directors') {
                                            res.render('resultado', { directors });
                                        } else {
                                            res.render('resultado', {movies, actors, directors});
                                        }
                                    }
                                }
                            );
                        }
                    }
                );
            }
        }
    );
});

// Ruta para la página de datos de una película particular
app.get('/pelicula/:id', (req, res) => {
    const movieId = req.params.id;

    // Consulta SQL para obtener los datos de la película, elenco y crew
    let query = `
    SELECT
      movie.*,
      actor.person_name as actor_name,
      actor.person_id as actor_id,
      crew_member.person_name as crew_member_name,
      crew_member.person_id as crew_member_id,
      movie_cast.character_name,
      movie_cast.cast_order,
      department.department_name,
      movie_crew.job,
      movie.budget,
      movie.revenue,
      movie.runtime,
      movie.vote_average,
      movie.vote_count,
      movie.popularity,
      movie.movie_status,
      movie.homepage,
      movie.tagline
    FROM movie
    LEFT JOIN movie_cast ON movie.movie_id = movie_cast.movie_id
    LEFT JOIN person as actor ON movie_cast.person_id = actor.person_id
    LEFT JOIN movie_crew ON movie.movie_id = movie_crew.movie_id
    LEFT JOIN department ON movie_crew.department_id = department.department_id
    LEFT JOIN person as crew_member ON crew_member.person_id = movie_crew.person_id
    WHERE movie.movie_id = ?`;

    // En vez de hacer una consulta grande que tenga toda la informacion sobre peliculas junto con los idiomas,
    // empresas, paises y etc, se separan en consultas pequenas y las ejecutamos con una serie de db.all() anidadas

    // Ejecutar la consulta
    db.all(query, [movieId], (err, rows) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error al cargar los datos de la película.');
        } else if (rows.length === 0) {
            res.status(404).send('Película no encontrada.');
        } else {
            // Organizar los datos en un objeto de película con elenco y crew
            const movieData = {
                id: rows[0].id,
                title: rows[0].title,
                release_date: rows[0].release_date,
                overview: rows[0].overview,
                directors: [],
                writers: [],
                cast: [],
                crew: [],
                genres: [],
                keywords: [],
                languages: [],
                countries: [],
                companies: [],
                budget: rows[0].budget,
                revenue: rows[0].revenue,
                runtime: rows[0].runtime,
                movie_status: rows[0].movie_status,
                vote_average: rows[0].vote_average,
                vote_count: rows[0].vote_count,
                popularity: rows[0].popularity,
                homepage: rows[0].homepage,
                tagline: rows[0].tagline
            };

            // Crear un objeto para almacenar directores
            rows.forEach((row) => {
                if (row.crew_member_id && row.crew_member_name && row.department_name && row.job) {
                    // Verificar si ya existe una entrada con los mismos valores en directors
                    const isDuplicate = movieData.directors.some((crew_member) =>
                        crew_member.crew_member_id === row.crew_member_id
                    );

                    if (!isDuplicate) {
                        // Si no existe, agregar los datos a la lista de directors
                        if (row.department_name === 'Directing' && row.job === 'Director') {
                            movieData.directors.push({
                                crew_member_id: row.crew_member_id,
                                crew_member_name: row.crew_member_name,
                                department_name: row.department_name,
                                job: row.job,
                            });
                        }
                    }
                }
            });

            // Crear un objeto para almacenar escritores
            rows.forEach((row) => {
                if (row.crew_member_id && row.crew_member_name && row.department_name && row.job) {
                    // Verificar si ya existe una entrada con los mismos valores en directors
                    const isDuplicate = movieData.writers.some((crew_member) =>
                        crew_member.crew_member_id === row.crew_member_id
                    );

                    if (!isDuplicate) {
                        // Si no existe, agregar los datos a la lista de escritores
                        if (row.department_name === 'Writing' && row.job === 'Writer') {
                            movieData.writers.push({
                                crew_member_id: row.crew_member_id,
                                crew_member_name: row.crew_member_name,
                                department_name: row.department_name,
                                job: row.job,
                            });
                        }
                    }
                }
            });

            // Crear un objeto para almacenar el elenco
            rows.forEach((row) => {
                if (row.actor_id && row.actor_name && row.character_name) {
                    // Verificar si ya existe una entrada con los mismos valores en el elenco
                    const isDuplicate = movieData.cast.some((actor) =>
                        actor.actor_id === row.actor_id
                    );

                    if (!isDuplicate) {
                    // Si no existe, agregar los datos a la lista de elenco
                        movieData.cast.push({
                            actor_id: row.actor_id,
                            actor_name: row.actor_name,
                            character_name: row.character_name,
                            cast_order: row.cast_order,
                        });
                    }
                }
            });

            // Crear un objeto para almacenar el crew
            rows.forEach((row) => {
                if (row.crew_member_id && row.crew_member_name && row.department_name && row.job) {
                    // Verificar si ya existe una entrada con los mismos valores en el crew
                    const isDuplicate = movieData.crew.some((crew_member) =>
                        crew_member.crew_member_id === row.crew_member_id
                    );

                    // console.log('movieData.crew: ', movieData.crew)
                    // console.log(isDuplicate, ' - row.crew_member_id: ', row.crew_member_id)
                    if (!isDuplicate) {
                        // Si no existe, agregar los datos a la lista de crew
                        if (row.department_name !== 'Directing' && row.job !== 'Director'
                        && row.department_name !== 'Writing' && row.job !== 'Writer') {
                            movieData.crew.push({
                                crew_member_id: row.crew_member_id,
                                crew_member_name: row.crew_member_name,
                                department_name: row.department_name,
                                job: row.job,
                            });
                        }
                    }
                }
            });

            // query para obtener todos los generos de la pelicula
            query = `
            SELECT
              g.genre_name,
              g.genre_id
            FROM movie
            left join movie_genres as mg on movie.movie_id=mg.movie_id
            left join genre as g on mg.genre_id=g.genre_id
            WHERE movie.movie_id = ?`

            db.all(query, [movieId], (err, rows) => {
                if (err) {
                    console.error(err);
                    res.status(500).send('Error al cargar los datos de la película.');
                } else {
                    // Crear un objeto para almacenar generos
                    rows.forEach((row) => {
                        if (row.genre_name && row.genre_id) {
                            // Verificar si ya existe una entrada con los mismos valores en directors
                            const isDuplicate = movieData.genres.some((movieGenre) =>
                                movieGenre.genre_id === row.genre_id
                            );

                            if (!isDuplicate) {
                                // Si no existe, agregar los datos a la lista de directors
                                movieData.genres.push({
                                    genre_name: row.genre_name,
                                    genre_id: row.genre_id
                                });
                            }
                        }
                    });

                    // query para obtener todos los keywords de la pelicula
                    query = `SELECT
                              k.keyword_name,
                              k.keyword_id
                            from movie
                            left join movie_keywords as mk on movie.movie_id=mk.movie_id
                            left join keyword as k on mk.keyword_id=k.keyword_id
                            WHERE movie.movie_id = ?`

                    // Ejecutar la consulta
                    db.all(query, [movieId], (err, rows) => {
                        if (err) {
                            console.error(err);
                            res.status(500).send('Error al cargar los datos de la película.');
                        } else {
                            // Crear un objeto para almacenar keywords
                            rows.forEach((row) => {
                                if (row.keyword_name && row.keyword_id) {
                                    // Verificar si ya existe una entrada con los mismos valores en directors
                                    const isDuplicate = movieData.keywords.some((movieKeyword) =>
                                        movieKeyword.keyword_id === row.keyword_id
                                    );

                                    if (!isDuplicate) {
                                        // Si no existe, agregar los datos a la lista de directors
                                        movieData.keywords.push({
                                            keyword_name: row.keyword_name,
                                            keyword_id: row.keyword_id
                                        });
                                    }
                                }
                            });

                            // query para obtener todos los idiomas de la pelicula
                            query = `SELECT
                                    l.language_name,
                                    l.language_id,
                                    ml.language_role_id
                                    from movie
                                    left join movie_languages as ml on movie.movie_id=ml.movie_id
                                    left join language as l on ml.language_id=l.language_id
                                    WHERE movie.movie_id = ?
                                    order by ml.language_role_id`

                            db.all(query, [movieId], (err, rows) => {
                                if (err) {
                                    console.error(err);
                                    res.status(500).send('Error al cargar los datos de la película.');
                                } else {

                                    // Crear un objeto para almacenar languagess
                                    rows.forEach((row) => {
                                        if (row.language_name && row.language_id && row.language_role_id) {
                                            // Verificar si ya existe una entrada con los mismos valores en directors
                                            const isDuplicate = movieData.languages.some((movieLanguage) =>
                                                movieLanguage.language_id === row.language_id && movieLanguage.language_role_id === row.language_role_id
                                            );
                                            if (!isDuplicate) {
                                                // Si no existe, agregar los datos a la lista de directors
                                                movieData.languages.push({
                                                    language_name: row.language_name,
                                                    language_id: row.language_id,
                                                    language_role_id: row.language_role_id
                                                });
                                            }
                                        }
                                    });

                                    // query para obtener todas las empresas involucradas en la produccion de la pelicula
                                    query = `SELECT
                                            pc.company_name,
                                            pc.company_id
                                            from movie
                                            left join movie_company as mc on movie.movie_id = mc.movie_id
                                            left join production_company as pc on mc.company_id=pc.company_id
                                            WHERE movie.movie_id = ?`

                                    db.all(query, [movieId], (err, rows) => {
                                        if (err) {
                                            console.error(err);
                                            res.status(500).send('Error al cargar los datos de la película.');
                                        } else {

                                            rows.forEach((row) => {
                                                if (row.company_name && row.company_id) {
                                                    // Verificar si ya existe una entrada con los mismos valores en directors
                                                    const isDuplicate = movieData.companies.some((movieCompany) =>
                                                        movieCompany.company_id === row.company_id
                                                    );
                                                    if (!isDuplicate) {
                                                        // Si no existe, agregar los datos a la lista de directors
                                                        movieData.companies.push({
                                                            company_name: row.company_name,
                                                            company_id: row.company_id
                                                        });
                                                    }
                                                }
                                            });

                                            // query para conseguir los paises vinculados con la pelicula
                                            query = `SELECT
                                                        c.country_name,
                                                        c.country_id
                                                        from movie
                                                        left join production_country as pc on movie.movie_id = pc.movie_id
                                                        left join country as c on pc.country_id = c.country_id
                                                    where movie.movie_id = ?`

                                            db.all(query, [movieId], (err, rows) => {
                                                if (err) {
                                                    console.error(err);
                                                    res.status(500).send('Error al cargar los datos de la película.');
                                                } else {

                                                    rows.forEach((row) => {
                                                        if (row.country_name && row.country_id) {
                                                            // Verificar si ya existe una entrada con los mismos valores en directors
                                                            const isDuplicate = movieData.countries.some((movieCountry) =>
                                                                movieCountry.country_id === row.country_id
                                                            );
                                                            if (!isDuplicate) {
                                                                // Si no existe, agregar los datos a la lista de directors
                                                                movieData.countries.push({
                                                                    country_name: row.country_name,
                                                                    country_id: row.country_id
                                                                });
                                                            }
                                                        }
                                                    });

                                                    res.render('pelicula', {movie: movieData});
                                                }
                                            })
                                        }
                                    })
                                }
                            })
                        }
                    })
                }
            })
        }
    });
});

// Ruta para mostrar la página de un actor específico
app.get('/actor/:id', (req, res) => {
    const actorId = req.params.id;

    // Consulta SQL para obtener las películas en las que participó el actor unida con las peliculas donde aparecio como director
    const query = `
    SELECT DISTINCT person.person_name as name, movie.*, 0 as role
    FROM movie
    JOIN movie_crew ON movie.movie_id = movie_crew.movie_id
    JOIN person ON person.person_id = movie_crew.person_id
    WHERE movie_crew.job = 'Director' AND movie_crew.person_id = ?
    UNION
    SELECT person.person_name as name, movie.*, 1 as role
    FROM movie
    JOIN movie_cast ON movie.movie_id = movie_cast.movie_id
    JOIN person ON person.person_id = movie_cast.person_id
    WHERE movie_cast.person_id = ?`;

    // Ejecutar la consulta
    db.all(query, [actorId, actorId], (err, movies) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error al cargar las películas del actor.');
        } else {
            // Obtener el nombre del actor
            const actorName = movies.length > 0 ? movies[0].name : '';

            res.render('actor', { actorName, movies });
        }
    });
});

// Ruta para mostrar la página de un director específico
app.get('/director/:id', (req, res) => {
    const directorId = req.params.id;

    // Consulta SQL para obtener las películas dirigidas por el director unida con las peliculas donde aperecio como actor
    const query = `
    SELECT DISTINCT
    person.person_name as name,
    movie.*, 0 as role
    FROM movie
    JOIN movie_crew ON movie.movie_id = movie_crew.movie_id
    JOIN person ON person.person_id = movie_crew.person_id
    WHERE movie_crew.job = 'Director' AND movie_crew.person_id = ?
    union
    select
    person.person_name as name,
    movie.*, 1 as role
    FROM movie
    JOIN movie_cast ON movie.movie_id = movie_cast.movie_id
    JOIN person ON person.person_id = movie_cast.person_id
    WHERE movie_cast.person_id = ?;
  `;

    // Ejecutar la consulta
    db.all(query, [directorId, directorId], (err, movies) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error al cargar las películas del director.');
        } else {
            console.log('movies.length = ', movies.length)
            // Obtener el nombre del director
            const directorName = movies.length > 0 ? movies[0].name : '';
            res.render('director', { directorName, movies });
        }
    });
});


// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor en ejecución en http://localhost:${port}`);
});
